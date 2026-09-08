from collections import Counter
from math import sqrt


DAMAGE_WEIGHTS = {
    "longitudinal crack": 8,
    "transverse crack": 9,
    "alligator crack": 14,
    "other corruption": 7,
    "pothole": 30,
}


def calculate_road_health(detections):
    """
    Calculate an AI-derived road health score.

    The scoring considers:
    - defect type severity
    - detection confidence
    - repeated defects
    - additional safety risk from potholes

    This is a prototype scoring system and is not an
    engineering or government road-condition standard.
    """

    if not detections:
        return {
            "score": 100,
            "severity": "Good",
            "priority": "Low",
            "damage_count": 0,
            "damage_breakdown": {},
            "penalty": 0,
        }

    breakdown = Counter()
    confidence_by_type = {}

    for detection in detections:
        damage_type = detection["class"]
        confidence = float(detection["confidence"])

        breakdown[damage_type] += 1

        if damage_type not in confidence_by_type:
            confidence_by_type[damage_type] = []

        confidence_by_type[damage_type].append(confidence)

    total_penalty = 0.0

    for damage_type, confidences in confidence_by_type.items():
        weight = DAMAGE_WEIGHTS.get(damage_type, 7)
        count = len(confidences)

        average_confidence = sum(confidences) / count

        # Normal defects use diminishing returns.
        count_factor = sqrt(count)

        penalty = weight * average_confidence * count_factor

        # Potholes receive an additional safety multiplier.
        if damage_type == "pothole":
            penalty *= 1.35

        total_penalty += penalty

    score = max(
        0,
        min(
            100,
            round(100 - total_penalty)
        )
    )

    # ---------------------------------------------------------
    # Defect-aware safety assessment
    # ---------------------------------------------------------

    pothole_count = breakdown.get("pothole", 0)

    pothole_confidences = confidence_by_type.get("pothole", [])

    average_pothole_confidence = (
        sum(pothole_confidences) / len(pothole_confidences)
        if pothole_confidences
        else 0
    )

    total_defects = len(detections)

    if pothole_count >= 3 and average_pothole_confidence >= 0.45:
        severity = "Critical"
        priority = "Critical"

    elif pothole_count >= 2 and average_pothole_confidence >= 0.45:
        severity = "Poor"
        priority = "High"

    elif pothole_count >= 1 and average_pothole_confidence >= 0.60:
        severity = "Moderate"
        priority = "Medium"

    elif total_defects >= 6:
        severity = "Moderate"
        priority = "Medium"

    elif score >= 80:
        severity = "Good"
        priority = "Low"

    elif score >= 60:
        severity = "Moderate"
        priority = "Medium"

    elif score >= 40:
        severity = "Poor"
        priority = "High"

    else:
        severity = "Critical"
        priority = "Critical"

    return {
        "score": score,
        "severity": severity,
        "priority": priority,
        "damage_count": total_defects,
        "damage_breakdown": dict(breakdown),
        "penalty": round(total_penalty, 2),
    }