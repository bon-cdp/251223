"""
Solver Output Parser - Parses optimization solver output for visualization.

Author: Henry Liang (henryliang35-create)
"""

import json
import re
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
import xml.etree.ElementTree as ET


@dataclass
class SolverGeometry:
    """Geometry data from solver output."""
    vertices: List[List[float]]  # [x, y, z]
    faces: List[List[int]]  # face vertex indices
    normals: Optional[List[List[float]]] = None
    colors: Optional[List[List[float]]] = None


@dataclass
class SolverBuilding:
    """Building data from solver output."""
    id: str
    geometry: SolverGeometry
    properties: Dict[str, Any]
    position: List[float]  # [x, y, z]
    rotation: List[float]  # [rx, ry, rz]
    scale: List[float]  # [sx, sy, sz]


@dataclass
class SolverSolution:
    """Complete solver solution."""
    buildings: List[SolverBuilding]
    site_boundary: List[List[float]]  # [x, y] points
    fitness_score: float
    constraints_satisfied: bool
    metadata: Dict[str, Any]


class SolverParser:
    """Parser for various solver output formats."""

    SUPPORTED_FORMATS = ['json', 'xml', 'csv', 'custom']

    def __init__(self):
        self.format_detectors = {
            'json': self._is_json_format,
            'xml': self._is_xml_format,
            'csv': self._is_csv_format
        }

    def parse(self, content: str, format_hint: str = 'auto') -> SolverSolution:
        """Parse solver output content."""
        if format_hint == 'auto':
            format_hint = self.detect_format(content)

        if format_hint == 'json':
            return self._parse_json(content)
        elif format_hint == 'xml':
            return self._parse_xml(content)
        elif format_hint == 'csv':
            return self._parse_csv(content)
        else:
            return self._parse_custom(content)

    def detect_format(self, content: str) -> str:
        """Detect the format of solver output."""
        content = content.strip()

        for format_name, detector in self.format_detectors.items():
            if detector(content):
                return format_name

        return 'custom'

    def _is_json_format(self, content: str) -> bool:
        """Check if content is JSON."""
        try:
            json.loads(content)
            return True
        except:
            return False

    def _is_xml_format(self, content: str) -> bool:
        """Check if content is XML."""
        try:
            ET.fromstring(content)
            return True
        except:
            return False

    def _is_csv_format(self, content: str) -> bool:
        """Check if content is CSV."""
        lines = content.strip().split('\n')
        if len(lines) < 2:
            return False
        first_line = lines[0]
        if ',' in first_line and len(first_line.split(',')) > 3:
            return True
        return False

    def _parse_json(self, content: str) -> SolverSolution:
        """Parse JSON format solver output."""
        try:
            data = json.loads(content)

            if 'buildings' in data:
                buildings_data = data['buildings']
            elif 'solutions' in data and len(data['solutions']) > 0:
                buildings_data = data['solutions'][0].get('buildings', [])
            else:
                buildings_data = self._find_buildings_in_json(data)

            buildings = []
            for bldg_data in buildings_data:
                building = self._parse_json_building(bldg_data)
                if building:
                    buildings.append(building)

            site_boundary = data.get('site_boundary', [])
            if not site_boundary and 'site' in data:
                site_boundary = data['site'].get('boundary', [])

            fitness_score = data.get('fitness', 0.0)
            if fitness_score == 0 and 'score' in data:
                fitness_score = data['score']

            constraints_satisfied = data.get('constraints_satisfied', True)

            metadata = data.get('metadata', {})
            metadata.update({
                'format': 'json',
                'parser_version': '1.0'
            })

            return SolverSolution(
                buildings=buildings,
                site_boundary=site_boundary,
                fitness_score=fitness_score,
                constraints_satisfied=constraints_satisfied,
                metadata=metadata
            )

        except Exception as e:
            raise ValueError(f"Failed to parse JSON: {str(e)}")

    def _parse_json_building(self, data: Dict) -> Optional[SolverBuilding]:
        """Parse individual building from JSON data."""
        try:
            geometry_data = data.get('geometry', {})

            if not geometry_data:
                for key in ['mesh', 'shape', 'polygon']:
                    if key in data:
                        geometry_data = data[key]
                        break

            vertices = geometry_data.get('vertices', [])
            faces = geometry_data.get('faces', [])

            if not vertices or not faces:
                if 'coordinates' in data:
                    vertices = self._extract_vertices_from_coordinates(data['coordinates'])
                    faces = self._generate_faces_for_vertices(vertices)

            geometry = SolverGeometry(
                vertices=vertices,
                faces=faces,
                normals=geometry_data.get('normals'),
                colors=geometry_data.get('colors')
            )

            properties = data.get('properties', {})
            if not properties:
                properties = {
                    k: v for k, v in data.items()
                    if k not in ['geometry', 'mesh', 'shape', 'position', 'rotation', 'scale', 'id']
                }

            position = data.get('position', [0, 0, 0])
            rotation = data.get('rotation', [0, 0, 0])
            scale = data.get('scale', [1, 1, 1])

            bldg_id = data.get('id', f"building_{hash(str(data)) % 10000}")

            return SolverBuilding(
                id=bldg_id,
                geometry=geometry,
                properties=properties,
                position=position,
                rotation=rotation,
                scale=scale
            )

        except Exception as e:
            print(f"Warning: Failed to parse building: {str(e)}")
            return None

    def _parse_xml(self, content: str) -> SolverSolution:
        """Parse XML format solver output."""
        try:
            root = ET.fromstring(content)

            buildings = []
            site_boundary = []
            fitness_score = 0.0
            constraints_satisfied = True

            for building_elem in root.findall('.//building'):
                building = self._parse_xml_building(building_elem)
                if building:
                    buildings.append(building)

            site_elem = root.find('.//site')
            if site_elem is not None:
                boundary_elem = site_elem.find('boundary')
                if boundary_elem is not None and boundary_elem.text:
                    points = boundary_elem.text.strip().split(';')
                    for point in points:
                        coords = point.strip().split(',')
                        if len(coords) >= 2:
                            site_boundary.append([float(coords[0]), float(coords[1])])

            score_elem = root.find('.//fitness')
            if score_elem is not None and score_elem.text:
                fitness_score = float(score_elem.text)

            constraints_elem = root.find('.//constraints')
            if constraints_elem is not None:
                satisfied = constraints_elem.get('satisfied', 'true')
                constraints_satisfied = satisfied.lower() == 'true'

            metadata = {
                'format': 'xml',
                'parser_version': '1.0',
                'root_tag': root.tag
            }

            return SolverSolution(
                buildings=buildings,
                site_boundary=site_boundary,
                fitness_score=fitness_score,
                constraints_satisfied=constraints_satisfied,
                metadata=metadata
            )

        except Exception as e:
            raise ValueError(f"Failed to parse XML: {str(e)}")

    def _parse_xml_building(self, elem: ET.Element) -> Optional[SolverBuilding]:
        """Parse individual building from XML element."""
        try:
            bldg_id = elem.get('id', f"building_{hash(ET.tostring(elem)) % 10000}")

            vertices = []
            faces = []

            geometry_elem = elem.find('geometry')
            if geometry_elem is not None:
                vertices_elem = geometry_elem.find('vertices')
                if vertices_elem is not None and vertices_elem.text:
                    vertex_text = vertices_elem.text.strip()
                    for vertex_line in vertex_text.split(';'):
                        coords = vertex_line.strip().split(',')
                        if len(coords) >= 3:
                            vertices.append([float(coords[0]), float(coords[1]), float(coords[2])])

                faces_elem = geometry_elem.find('faces')
                if faces_elem is not None and faces_elem.text:
                    face_text = faces_elem.text.strip()
                    for face_line in face_text.split(';'):
                        indices = face_line.strip().split(',')
                        if len(indices) >= 3:
                            faces.append([int(idx) for idx in indices])

            properties = {}
            props_elem = elem.find('properties')
            if props_elem is not None:
                for prop_elem in props_elem:
                    if prop_elem.text:
                        try:
                            value = float(prop_elem.text)
                        except:
                            value = prop_elem.text
                        properties[prop_elem.tag] = value

            position = [0, 0, 0]
            rotation = [0, 0, 0]
            scale = [1, 1, 1]

            transform_elem = elem.find('transform')
            if transform_elem is not None:
                pos_elem = transform_elem.find('position')
                if pos_elem is not None and pos_elem.text:
                    pos_coords = pos_elem.text.strip().split(',')
                    if len(pos_coords) >= 3:
                        position = [float(coord) for coord in pos_coords[:3]]

                rot_elem = transform_elem.find('rotation')
                if rot_elem is not None and rot_elem.text:
                    rot_coords = rot_elem.text.strip().split(',')
                    if len(rot_coords) >= 3:
                        rotation = [float(coord) for coord in rot_coords[:3]]

                scale_elem = transform_elem.find('scale')
                if scale_elem is not None and scale_elem.text:
                    scale_coords = scale_elem.text.strip().split(',')
                    if len(scale_coords) >= 3:
                        scale = [float(coord) for coord in scale_coords[:3]]

            geometry = SolverGeometry(vertices=vertices, faces=faces)

            return SolverBuilding(
                id=bldg_id,
                geometry=geometry,
                properties=properties,
                position=position,
                rotation=rotation,
                scale=scale
            )

        except Exception as e:
            print(f"Warning: Failed to parse XML building: {str(e)}")
            return None

    def _parse_csv(self, content: str) -> SolverSolution:
        """Parse CSV format solver output."""
        print("CSV parsing not fully implemented - using fallback")
        return self._create_fallback_solution()

    def _parse_custom(self, content: str) -> SolverSolution:
        """Parse custom format solver output."""
        buildings = []
        lines = content.split('\n')

        for i, line in enumerate(lines):
            if 'building' in line.lower() or 'bldg' in line.lower():
                building = self._extract_building_from_context(lines, i)
                if building:
                    buildings.append(building)

        return SolverSolution(
            buildings=buildings,
            site_boundary=[],
            fitness_score=0.0,
            constraints_satisfied=True,
            metadata={
                'format': 'custom',
                'parser_version': '1.0',
                'warning': 'Custom format parsing used - may be incomplete'
            }
        )

    def _extract_building_from_context(self, lines: List[str], idx: int) -> Optional[SolverBuilding]:
        """Extract building data from context around a line."""
        vertices = []
        for j in range(max(0, idx - 5), min(len(lines), idx + 5)):
            line = lines[j]
            coord_pattern = r'[-+]?\d*\.?\d+'
            matches = re.findall(rf'({coord_pattern}\s*,\s*{coord_pattern}\s*,\s*{coord_pattern})', line)
            for match in matches:
                coords = [float(c.strip()) for c in match.split(',')]
                if len(coords) >= 3:
                    vertices.append(coords[:3])

        if len(vertices) >= 4:
            faces = self._generate_faces_for_vertices(vertices[:8])
            geometry = SolverGeometry(vertices=vertices[:8], faces=faces)

            return SolverBuilding(
                id=f"extracted_{idx}",
                geometry=geometry,
                properties={"source": "extracted"},
                position=[0, 0, 0],
                rotation=[0, 0, 0],
                scale=[1, 1, 1]
            )

        return None

    def _find_buildings_in_json(self, data: Dict, path: str = '') -> List[Dict]:
        """Recursively find building data in JSON structure."""
        buildings = []

        if isinstance(data, dict):
            if self._looks_like_building(data):
                buildings.append(data)

            for key, value in data.items():
                if isinstance(value, (dict, list)):
                    buildings.extend(self._find_buildings_in_json(value, f"{path}.{key}"))

        elif isinstance(data, list):
            for item in data:
                if isinstance(item, (dict, list)):
                    buildings.extend(self._find_buildings_in_json(item, path))

        return buildings

    def _looks_like_building(self, data: Dict) -> bool:
        """Heuristic to check if data looks like a building."""
        building_keywords = ['vertices', 'faces', 'position', 'height', 'width', 'depth']

        score = 0
        for keyword in building_keywords:
            if keyword in data:
                score += 1

        for value in data.values():
            if isinstance(value, (int, float)) and 1 < value < 1000:
                score += 0.5

        return score >= 2

    def _extract_vertices_from_coordinates(self, coords_data: Any) -> List[List[float]]:
        """Extract vertices from various coordinate representations."""
        vertices = []

        if isinstance(coords_data, list):
            for item in coords_data:
                if isinstance(item, list):
                    if len(item) >= 3:
                        vertices.append([float(item[0]), float(item[1]), float(item[2])])
                    elif len(item) >= 2:
                        vertices.append([float(item[0]), float(item[1]), 0.0])

        return vertices

    def _generate_faces_for_vertices(self, vertices: List[List[float]]) -> List[List[int]]:
        """Generate faces for a set of vertices (assuming box-like structure)."""
        if len(vertices) < 4:
            return []

        if len(vertices) >= 8:
            return [
                [0, 1, 2, 3],
                [4, 5, 6, 7],
                [0, 1, 5, 4],
                [2, 3, 7, 6],
                [0, 3, 7, 4],
                [1, 2, 6, 5]
            ]
        elif len(vertices) >= 4:
            return [[0, 1, 2, 3]]

        return []

    def _create_fallback_solution(self) -> SolverSolution:
        """Create a fallback solution when parsing fails."""
        vertices = [
            [0, 0, 0], [10, 0, 0], [10, 10, 0], [0, 10, 0],
            [0, 0, 20], [10, 0, 20], [10, 10, 20], [0, 10, 20]
        ]

        faces = [
            [0, 1, 2, 3],
            [4, 5, 6, 7],
            [0, 1, 5, 4],
            [2, 3, 7, 6],
            [0, 3, 7, 4],
            [1, 2, 6, 5]
        ]

        geometry = SolverGeometry(vertices=vertices, faces=faces)

        building = SolverBuilding(
            id="fallback_building",
            geometry=geometry,
            properties={"type": "fallback", "area": 100, "height": 20},
            position=[0, 0, 0],
            rotation=[0, 0, 0],
            scale=[1, 1, 1]
        )

        site_boundary = [[0, 0], [50, 0], [50, 50], [0, 50]]

        return SolverSolution(
            buildings=[building],
            site_boundary=site_boundary,
            fitness_score=0.0,
            constraints_satisfied=True,
            metadata={
                'format': 'fallback',
                'parser_version': '1.0'
            }
        )
