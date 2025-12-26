"""
LLM Integrator with DashScope/OpenAI support.

Processes extracted text for structured output.

Author: Henry Liang (henryliang35-create)
"""

import os
import json
import re
from typing import Dict, Optional, Any
from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum
from datetime import datetime

try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False


class LLMProvider(Enum):
    """Supported LLM providers."""
    DASHSCOPE = "dashscope"
    OPENAI = "openai"
    FALLBACK = "fallback"


@dataclass
class LLMConfig:
    """Configuration for LLM integration."""
    provider: LLMProvider = LLMProvider.FALLBACK
    api_key: Optional[str] = None
    model: str = "qwen-max"  # DashScope default
    temperature: float = 0.1
    max_tokens: int = 2000


class BaseLLMIntegrator(ABC):
    """Abstract base class for LLM integrators."""

    @abstractmethod
    def process_text(self, text: str, instructions: str) -> Dict:
        """Process text with LLM."""
        pass

    @abstractmethod
    def validate_response(self, response: Dict) -> bool:
        """Validate LLM response structure."""
        pass


class DashScopeIntegrator(BaseLLMIntegrator):
    """DashScope (Alibaba Cloud) LLM integration."""

    def __init__(self, config: LLMConfig):
        self.config = config
        # Use international endpoint (intl) for non-China regions
        self.base_url = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"

    def process_text(self, text: str, instructions: str) -> Dict:
        """Process text using DashScope API."""
        if not HAS_REQUESTS:
            raise ImportError("requests is required. Install with: pip install requests")

        headers = {
            "Authorization": f"Bearer {self.config.api_key}",
            "Content-Type": "application/json"
        }

        prompt = f"""{instructions}

EXTRACTED TEXT:
{text}

Please analyze the text and extract structured information.
Focus on property details, dimensions, constraints, and requirements.
Return ONLY valid JSON format."""

        payload = {
            "model": self.config.model,
            "messages": [
                {"role": "system", "content": "You are a real estate data extraction assistant. Always return valid JSON."},
                {"role": "user", "content": prompt}
            ],
            "temperature": self.config.temperature,
            "max_tokens": self.config.max_tokens
        }

        try:
            response = requests.post(
                f"{self.base_url}/chat/completions",
                headers=headers,
                json=payload,
                timeout=30
            )
            response.raise_for_status()

            result = response.json()
            content = result["choices"][0]["message"]["content"]

            # Extract JSON from response
            json_match = re.search(r'\{.*\}', content, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
            else:
                return {"error": "No JSON found in response", "raw_response": content}

        except Exception as e:
            raise Exception(f"DashScope API error: {str(e)}")

    def validate_response(self, response: Dict) -> bool:
        """Validate LLM response structure."""
        required_fields = ["properties", "constraints", "metadata"]
        return all(field in response for field in required_fields)


class OpenAIIntegrator(BaseLLMIntegrator):
    """OpenAI GPT integration."""

    def __init__(self, config: LLMConfig):
        self.config = config
        try:
            from openai import OpenAI
            self.client = OpenAI(api_key=config.api_key)
        except ImportError:
            raise ImportError("OpenAI package not installed. Run: pip install openai")

    def process_text(self, text: str, instructions: str) -> Dict:
        """Process text using OpenAI API."""
        prompt = f"""{instructions}

EXTRACTED TEXT:
{text}

Extract structured real estate data in JSON format."""

        try:
            response = self.client.chat.completions.create(
                model=self.config.model if self.config.model != "qwen-max" else "gpt-4-turbo-preview",
                messages=[
                    {"role": "system", "content": "Extract structured real estate data. Return valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=self.config.temperature,
                max_tokens=self.config.max_tokens,
                response_format={"type": "json_object"}
            )

            content = response.choices[0].message.content
            return json.loads(content)

        except Exception as e:
            raise Exception(f"OpenAI API error: {str(e)}")

    def validate_response(self, response: Dict) -> bool:
        """Validate OpenAI response structure."""
        return bool(response) and isinstance(response, dict)


class FallbackRegexIntegrator(BaseLLMIntegrator):
    """Fallback regex-based extraction when LLM is unavailable."""

    def __init__(self):
        self.patterns = {
            "area": re.compile(r'area[\s:]*([\d,]+\.?\d*)\s*(sq\.?|square|SF|ft)', re.IGNORECASE),
            "dimensions": re.compile(r'(\d+[\'\"]?\s*[x×]\s*\d+[\'\"]?)', re.IGNORECASE),
            "zoning": re.compile(r'zoning[\s:]*([A-Z0-9\-]+)', re.IGNORECASE),
            "setback": re.compile(r'setback[\s:]*([\d\.]+)\s*(feet|ft|m)', re.IGNORECASE)
        }

    def process_text(self, text: str, instructions: str) -> Dict:
        """Extract information using regex patterns."""
        extracted = {
            "properties": {},
            "constraints": {},
            "metadata": {"extraction_method": "regex_fallback"},
            "warnings": ["Using fallback regex extraction - some data may be missing"]
        }

        # Extract using patterns
        for key, pattern in self.patterns.items():
            matches = pattern.findall(text)
            if matches:
                extracted["properties"][key] = matches[0][0] if isinstance(matches[0], tuple) else matches[0]

        # Look for APN references (placeholders already in text)
        apn_refs = re.findall(r'\{APN_\d+\}', text)
        if apn_refs:
            extracted["properties"]["apn_references"] = list(set(apn_refs))

        # Extract numerical values for massing
        numbers = re.findall(r'\b\d+\.?\d*\b', text)
        extracted["properties"]["numerical_values"] = [float(n) for n in numbers if float(n) > 1]

        return extracted

    def validate_response(self, response: Dict) -> bool:
        """Always return True for fallback (better than nothing)."""
        return True


class LLMIntegratorFactory:
    """Factory for creating LLM integrators based on configuration."""

    @staticmethod
    def create_integrator(config: LLMConfig) -> BaseLLMIntegrator:
        """Create appropriate LLM integrator."""
        if config.provider == LLMProvider.DASHSCOPE and config.api_key:
            return DashScopeIntegrator(config)
        elif config.provider == LLMProvider.OPENAI and config.api_key:
            return OpenAIIntegrator(config)
        else:
            print("WARNING: Using fallback regex extraction. For better results, provide API keys.")
            return FallbackRegexIntegrator()


class LLMProcessor:
    """Main LLM processor with multi-provider support."""

    def __init__(self, config: Optional[LLMConfig] = None):
        self.config = config or LLMConfig()
        self.integrator = LLMIntegratorFactory.create_integrator(self.config)
        self.processing_history = []

    def process_extracted_text(self, extracted_data: Dict) -> Dict:
        """Process extracted PDF text through LLM."""
        text = extracted_data.get("full_text", "")

        instructions = """
        Extract structured real estate development information including:
        1. Property details (APN references, area, dimensions)
        2. Zoning constraints and regulations
        3. Setback requirements
        4. Maximum building height
        5. Parking requirements
        6. Special conditions or notes

        Format the output as JSON with these top-level keys:
        - properties: object with property details
        - constraints: object with regulatory constraints
        - metadata: object with extraction metadata
        - recommendations: array of development suggestions (optional)
        """

        try:
            # Process with selected integrator
            structured_data = self.integrator.process_text(text, instructions)

            # Validate response
            if not self.integrator.validate_response(structured_data):
                raise ValueError("LLM response validation failed")

            # Enhance with APN mapping
            if "apn_mapping" in extracted_data:
                structured_data["apn_mapping"] = extracted_data["apn_mapping"]

            # Add metadata
            if "metadata" not in structured_data:
                structured_data["metadata"] = {}

            structured_data["metadata"].update({
                "llm_provider": self.config.provider.value,
                "processing_time": datetime.now().isoformat(),
                "pdf_hash": extracted_data.get("pdf_hash", ""),
                "schema_version": "1.0"
            })

            # Log processing
            self.processing_history.append({
                "timestamp": datetime.now().isoformat(),
                "pdf_hash": extracted_data.get("pdf_hash", ""),
                "provider": self.config.provider.value,
                "success": True
            })

            return structured_data

        except Exception as e:
            # Log failure
            self.processing_history.append({
                "timestamp": datetime.now().isoformat(),
                "pdf_hash": extracted_data.get("pdf_hash", ""),
                "provider": self.config.provider.value,
                "success": False,
                "error": str(e)
            })

            # Return fallback extraction
            print(f"LLM processing failed: {e}. Using enhanced fallback.")
            fallback = FallbackRegexIntegrator()
            structured_data = fallback.process_text(text, instructions)
            structured_data["metadata"]["error"] = str(e)
            return structured_data

    def save_processing_results(self, output_path: str, data: Dict):
        """Save LLM processing results."""
        with open(output_path, 'w') as f:
            json.dump(data, f, indent=2)

    def get_processing_stats(self) -> Dict:
        """Get processing statistics."""
        total = len(self.processing_history)
        successful = sum(1 for entry in self.processing_history if entry.get("success", False))

        return {
            "total_processings": total,
            "successful": successful,
            "success_rate": successful / total if total > 0 else 0,
            "last_processing": self.processing_history[-1] if self.processing_history else None
        }


if __name__ == "__main__":
    # Demo usage
    config = LLMConfig(
        provider=LLMProvider.FALLBACK,
        api_key=os.getenv("DASHSCOPE_API_KEY")
    )

    processor = LLMProcessor(config)

    # Sample extracted data
    sample_data = {
        "full_text": "Property APN: {APN_1}. Area: 10,000 SF. Zoning: R-3. Setback: 20 feet.",
        "apn_mapping": {"{APN_1}": "123-456-789"},
        "pdf_hash": "sample_hash"
    }

    result = processor.process_extracted_text(sample_data)
    print(json.dumps(result, indent=2))
