from datetime import datetime
import json
from pathlib import Path


def generate_report(detections, health, image_name):
    """Generate a structured RoadVision inspection report."""

    report = {
        "project": "RoadVision AI",
        "inspection": {
            "image": image_name,
            "date": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        },
        "road_condition": {
            "health_score": health["score"],
            "severity": health["severity"],
            "maintenance_priority": health["priority"],
        },
        "damage_summary": {
            "total_defects": health["damage_count"],
            "breakdown": health["damage_breakdown"],
        },
        "detections": detections,
        "recommendation": get_recommendation(
            health["priority"]
        ),
    }

    return report


def get_recommendation(priority):
    recommendations = {
        "Low": "Continue routine monitoring and maintenance.",
        "Medium": "Schedule road inspection and planned maintenance.",
        "High": "Prioritize inspection and repair work.",
        "Critical": "Immediate inspection and urgent maintenance recommended.",
    }

    return recommendations.get(
        priority,
        "Further inspection recommended.",
    )


def save_report(report, output_path):
    """Save report as a JSON file."""

    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, "w", encoding="utf-8") as file:
        json.dump(report, file, indent=4)

    return output_path