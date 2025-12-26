"""
Complete Pipeline Runner - Runs the full PDF to optimization pipeline.

Author: Henry Liang (henryliang35-create)
"""

import os
import json
from datetime import datetime
from typing import Dict, Any, Optional

from .pdf_extractor import PDFExtractor
from .llm_integrator import LLMProcessor, LLMConfig, LLMProvider
from .massing_optimizer import MassingOptimizer, ConstraintParser, OptimizationObjective
from .solver_parser import SolverParser


class PipelineRunner:
    """Runs the complete PDF processing pipeline."""

    def __init__(self, config_path: Optional[str] = None):
        self.config = self._load_config(config_path)
        self.pipeline_steps = []
        self.results = {}

    def _load_config(self, config_path: Optional[str]) -> Dict:
        """Load configuration from file or use defaults."""
        default_config = {
            "pdf_extraction": {
                "apn_pattern": r'\b\d{3}-\d{3}-\d{3}\b',
                "save_intermediate": True
            },
            "llm": {
                "provider": "fallback",
                "api_key": os.getenv("DASHSCOPE_API_KEY") or os.getenv("OPENAI_API_KEY"),
                "model": "qwen-max",
                "temperature": 0.1
            },
            "optimization": {
                "objective": "maximize_value",
                "time_limit": 60
            },
            "output": {
                "save_all_results": True,
                "output_dir": "./output",
                "generate_visualization": True
            }
        }

        if config_path and os.path.exists(config_path):
            try:
                with open(config_path, 'r') as f:
                    user_config = json.load(f)
                self._merge_dicts(default_config, user_config)
            except Exception as e:
                print(f"Warning: Could not load config file {config_path}: {e}")

        return default_config

    def _merge_dicts(self, base: Dict, override: Dict):
        """Recursively merge dictionaries."""
        for key, value in override.items():
            if key in base and isinstance(base[key], dict) and isinstance(value, dict):
                self._merge_dicts(base[key], value)
            else:
                base[key] = value

    def run_pipeline(self, pdf_path: str, output_dir: Optional[str] = None) -> Dict:
        """Run the complete pipeline on a PDF file."""
        print(f"\n{'=' * 60}")
        print(f"Starting PDF Pipeline: {pdf_path}")
        print(f"Timestamp: {datetime.now().isoformat()}")
        print(f"{'=' * 60}\n")

        if output_dir:
            self.config["output"]["output_dir"] = output_dir

        output_dir = self.config["output"]["output_dir"]
        os.makedirs(output_dir, exist_ok=True)

        try:
            # Step 1: PDF Extraction
            print("\n[1/4] Extracting text from PDF...")
            pdf_extractor = PDFExtractor()
            extracted_data = pdf_extractor.extract_text_with_apn_placeholders(pdf_path)

            print(f"  Extracted {extracted_data['total_pages']} pages")
            print(f"  Found {extracted_data['total_apns']} APN values")

            extraction_file = os.path.join(output_dir, "01_extraction.json")
            pdf_extractor.save_extraction_results(extraction_file)

            print(pdf_extractor.get_apn_mapping_table())

            self.results["extraction"] = {
                "file": extraction_file,
                "data": extracted_data,
                "success": True
            }

            # Step 2: LLM Processing
            print("\n[2/4] Processing with LLM...")

            llm_config = LLMConfig(
                provider=LLMProvider(self.config["llm"]["provider"]),
                api_key=self.config["llm"]["api_key"],
                model=self.config["llm"]["model"],
                temperature=self.config["llm"]["temperature"]
            )

            llm_processor = LLMProcessor(llm_config)
            llm_data = llm_processor.process_extracted_text(extracted_data)

            print(f"  LLM Provider: {llm_config.provider.value}")
            print(f"  Extraction method: {llm_data.get('metadata', {}).get('extraction_method', 'llm')}")

            llm_file = os.path.join(output_dir, "02_llm_processed.json")
            llm_processor.save_processing_results(llm_file, llm_data)

            self.results["llm"] = {
                "file": llm_file,
                "data": llm_data,
                "success": True
            }

            # Step 3: Constraint Parsing & Optimization
            print("\n[3/4] Running massing optimization...")

            constraints = ConstraintParser.parse_from_llm_output(llm_data)

            print(f"  Site Area: {constraints.total_area:.0f} SF")
            print(f"  Max Height: {constraints.max_height:.0f} ft")
            print(f"  FAR: {constraints.max_far}")

            optimizer = MassingOptimizer()
            objective = OptimizationObjective(self.config["optimization"]["objective"])

            solution = optimizer.optimize(
                constraints,
                objective,
                time_limit=self.config["optimization"]["time_limit"]
            )

            print(f"  Optimal Units: {solution.total_units}")
            print(f"  Total Area: {solution.total_area:.0f} SF")
            print(f"  Building Height: {solution.building_height:.0f} ft")
            print(f"  Unit Mix: {solution.unit_mix}")

            massing_params = optimizer.generate_3d_massing_parameters(solution, constraints)

            optimization_results = {
                "constraints": self._dataclass_to_dict(constraints),
                "solution": self._dataclass_to_dict(solution),
                "massing_parameters": massing_params,
                "objective": objective.value,
                "optimization_time": datetime.now().isoformat()
            }

            optimization_file = os.path.join(output_dir, "03_optimization.json")
            with open(optimization_file, 'w') as f:
                json.dump(optimization_results, f, indent=2)

            self.results["optimization"] = {
                "file": optimization_file,
                "data": optimization_results,
                "success": True
            }

            # Step 4: Generate Solver Output
            print("\n[4/4] Generating solver output...")

            solver_parser = SolverParser()
            solver_output = self._create_solver_output(solution, massing_params)
            solver_json = json.dumps(solver_output, indent=2)

            parsed_solution = solver_parser.parse(solver_json, 'json')

            solver_file = os.path.join(output_dir, "04_solver_output.json")
            with open(solver_file, 'w') as f:
                f.write(solver_json)

            if self.config["output"]["generate_visualization"]:
                viz_data = {
                    "buildings": solver_output["buildings"],
                    "site": solver_output["site_boundary"],
                    "metadata": {"format": "simplified_gltf"}
                }
                viz_file = os.path.join(output_dir, "05_visualization.json")
                with open(viz_file, 'w') as f:
                    json.dump(viz_data, f, indent=2)

            self.results["solver"] = {
                "file": solver_file,
                "data": parsed_solution,
                "success": True
            }

            # Pipeline Summary
            print(f"\n{'=' * 60}")
            print("PIPELINE COMPLETE - SUCCESS!")
            print(f"{'=' * 60}")

            summary = {
                "input_pdf": pdf_path,
                "output_directory": output_dir,
                "files_generated": [
                    extraction_file,
                    llm_file,
                    optimization_file,
                    solver_file
                ],
                "statistics": {
                    "pages_extracted": extracted_data["total_pages"],
                    "apns_found": extracted_data["total_apns"],
                    "optimal_units": solution.total_units,
                    "total_area": solution.total_area,
                    "building_height": solution.building_height,
                    "efficiency": f"{solution.efficiency:.1%}"
                },
                "timestamp": datetime.now().isoformat(),
                "pipeline_version": "1.0"
            }

            summary_file = os.path.join(output_dir, "pipeline_summary.json")
            with open(summary_file, 'w') as f:
                json.dump(summary, f, indent=2)

            print(f"\nOutput files saved to: {output_dir}/")
            print(f"Summary: {summary_file}")

            return summary

        except Exception as e:
            print(f"\n{'=' * 60}")
            print("PIPELINE FAILED")
            print(f"{'=' * 60}")
            print(f"Error: {e}")

            error_file = os.path.join(output_dir, "pipeline_error.json")
            with open(error_file, 'w') as f:
                json.dump({
                    "error": str(e),
                    "step": len(self.results) + 1,
                    "timestamp": datetime.now().isoformat()
                }, f, indent=2)

            raise

    def _dataclass_to_dict(self, obj):
        """Convert dataclass to dictionary."""
        if hasattr(obj, '__dict__'):
            return {k: self._dataclass_to_dict(v) for k, v in obj.__dict__.items() if not k.startswith('_')}
        elif isinstance(obj, list):
            return [self._dataclass_to_dict(item) for item in obj]
        elif isinstance(obj, dict):
            return {k: self._dataclass_to_dict(v) for k, v in obj.items()}
        else:
            return obj

    def _create_solver_output(self, solution, massing_params):
        """Create simulated solver output."""
        dims = massing_params["dimensions"]

        vertices = [
            [0, 0, 0],
            [dims["length"], 0, 0],
            [dims["length"], dims["width"], 0],
            [0, dims["width"], 0],
            [0, 0, dims["height"]],
            [dims["length"], 0, dims["height"]],
            [dims["length"], dims["width"], dims["height"]],
            [0, dims["width"], dims["height"]]
        ]

        faces = [
            [0, 1, 2, 3],
            [4, 5, 6, 7],
            [0, 1, 5, 4],
            [2, 3, 7, 6],
            [0, 3, 7, 4],
            [1, 2, 6, 5]
        ]

        solver_output = {
            "buildings": [
                {
                    "id": "optimized_building",
                    "geometry": {
                        "vertices": vertices,
                        "faces": faces
                    },
                    "properties": {
                        "type": "residential",
                        "units": solution.total_units,
                        "area": solution.total_area,
                        "value": solution.total_value,
                        "unit_mix": solution.unit_mix
                    },
                    "position": [0, 0, 0],
                    "rotation": [0, 0, 0],
                    "scale": [1, 1, 1]
                }
            ],
            "site_boundary": [
                [0, 0],
                [dims["length"] * 2, 0],
                [dims["length"] * 2, dims["width"] * 2],
                [0, dims["width"] * 2]
            ],
            "fitness": solution.efficiency,
            "constraints_satisfied": solution.constraints_met,
            "metadata": {
                "solver": "massing_optimizer",
                "pipeline_version": "1.0",
                "optimization_objective": self.config["optimization"]["objective"]
            }
        }

        return solver_output
