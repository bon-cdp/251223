"""
PDF Extractor with APN Placeholder System.

Extracts text from PDFs and replaces APN values with placeholders.

Author: Henry Liang (henryliang35-create)
"""

import re
import json
import hashlib
from typing import Dict, List, Tuple
from datetime import datetime

try:
    import pdfplumber
    HAS_PDFPLUMBER = True
except ImportError:
    HAS_PDFPLUMBER = False


class PDFExtractor:
    """Extract text from PDFs with APN placeholder substitution."""

    def __init__(self):
        self.apn_pattern = re.compile(r'\b\d{3}-\d{3}-\d{3}\b')  # Standard APN format
        self.apn_mapping = {}  # Maps placeholder -> original APN
        self.extracted_data = {}
        self.pdf_hash = ""

    def extract_text_with_apn_placeholders(self, pdf_path: str) -> Dict:
        """
        Extract text from PDF and replace APN values with placeholders.

        Returns text with placeholders and APN mapping.
        """
        if not HAS_PDFPLUMBER:
            raise ImportError(
                "pdfplumber is required for PDF extraction. "
                "Install with: pip install pdfplumber"
            )

        try:
            with pdfplumber.open(pdf_path) as pdf:
                # Calculate PDF hash for version tracking
                self.pdf_hash = self._calculate_pdf_hash(pdf_path)

                full_text = ""
                page_data = []

                for page_num, page in enumerate(pdf.pages, 1):
                    text = page.extract_text()
                    if text:
                        # Replace APN values with placeholders
                        processed_text, apns_found = self._replace_apns_with_placeholders(text)
                        full_text += processed_text + "\n\n"

                        page_data.append({
                            "page": page_num,
                            "original_text": text,
                            "processed_text": processed_text,
                            "apns_found": apns_found
                        })

                self.extracted_data = {
                    "pdf_hash": self.pdf_hash,
                    "total_pages": len(pdf.pages),
                    "full_text": full_text.strip(),
                    "page_data": page_data,
                    "apn_mapping": self.apn_mapping,
                    "total_apns": len(self.apn_mapping),
                    "extraction_time": datetime.now().isoformat(),
                    "schema_version": "1.0"
                }

                return self.extracted_data

        except Exception as e:
            raise Exception(f"PDF extraction failed: {str(e)}")

    def _replace_apns_with_placeholders(self, text: str) -> Tuple[str, List[str]]:
        """
        Replace APN values with {APN_N} placeholders.

        Returns processed text and list of APNs found.
        """
        apns_found = []

        def replace_match(match):
            apn = match.group(0)
            if apn not in self.apn_mapping.values():
                placeholder = f"{{APN_{len(self.apn_mapping) + 1}}}"
                self.apn_mapping[placeholder] = apn
                apns_found.append(apn)
                return placeholder
            else:
                # Find existing placeholder for this APN
                for placeholder, original_apn in self.apn_mapping.items():
                    if original_apn == apn:
                        return placeholder
                return apn

        processed_text = self.apn_pattern.sub(replace_match, text)
        return processed_text, apns_found

    def _calculate_pdf_hash(self, pdf_path: str) -> str:
        """Calculate hash of PDF for version tracking."""
        with open(pdf_path, 'rb') as f:
            return hashlib.md5(f.read()).hexdigest()

    def save_extraction_results(self, output_path: str):
        """Save extraction results to JSON file."""
        with open(output_path, 'w') as f:
            json.dump(self.extracted_data, f, indent=2)

    def get_apn_mapping_table(self) -> str:
        """Generate human-readable APN mapping table."""
        if not self.apn_mapping:
            return "No APNs found"

        table = "APN Placeholder Mapping:\n"
        table += "-" * 40 + "\n"
        table += "Placeholder    | Original APN\n"
        table += "-" * 40 + "\n"

        for placeholder, apn in sorted(self.apn_mapping.items()):
            table += f"{placeholder:14} | {apn}\n"

        return table


class SchemaVersioner:
    """Schema versioning for backward compatibility."""

    SCHEMA_VERSIONS = {
        "1.0": {
            "required_fields": ["pdf_hash", "full_text", "apn_mapping"],
            "description": "Initial schema with APN placeholder system"
        }
    }

    @staticmethod
    def validate_data(data: Dict, version: str = "1.0") -> bool:
        """Validate extracted data against schema version."""
        if version not in SchemaVersioner.SCHEMA_VERSIONS:
            return False

        required = SchemaVersioner.SCHEMA_VERSIONS[version]["required_fields"]
        return all(field in data for field in required)

    @staticmethod
    def migrate_data(data: Dict, from_version: str, to_version: str) -> Dict:
        """Migrate data between schema versions."""
        if from_version == "1.0" and to_version == "1.0":
            return data
        raise ValueError(f"Migration from {from_version} to {to_version} not implemented")


if __name__ == "__main__":
    # Demo usage
    extractor = PDFExtractor()
    print("PDFExtractor ready. Use extract_text_with_apn_placeholders(pdf_path) to extract.")
