"""
PDF Pipeline Module - Henry's PDF-to-Solver Pipeline

Provides PDF extraction, LLM processing, and optimization pipeline
for converting PDF documents into solver inputs.

Contributors:
- Henry Liang (henryliang35-create)
"""

from .pdf_extractor import PDFExtractor, SchemaVersioner
from .llm_integrator import (
    LLMProcessor,
    LLMConfig,
    LLMProvider,
    LLMIntegratorFactory,
)
from .massing_optimizer import (
    MassingOptimizer,
    ConstraintParser,
    OptimizationObjective,
    SiteConstraints,
    UnitType,
    BuildingMassing,
)
from .solver_parser import SolverParser, SolverSolution, SolverBuilding, SolverGeometry
from .run_pipeline import PipelineRunner

__all__ = [
    # PDF Extraction
    "PDFExtractor",
    "SchemaVersioner",
    # LLM Integration
    "LLMProcessor",
    "LLMConfig",
    "LLMProvider",
    "LLMIntegratorFactory",
    # Optimization
    "MassingOptimizer",
    "ConstraintParser",
    "OptimizationObjective",
    "SiteConstraints",
    "UnitType",
    "BuildingMassing",
    # Solver Parsing
    "SolverParser",
    "SolverSolution",
    "SolverBuilding",
    "SolverGeometry",
    # Pipeline
    "PipelineRunner",
]
