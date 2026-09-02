from collections import Counter
from math import sqrt


DAMAGE_WEIGHTS = {
    "longitudinal crack": 8,
    "transverse crack": 9,
    "alligator crack": 14,
    "other corruption": 7,
    "pothole": 18,
}


def calculate_road_health(detections):
    """
    Calculate an AI-derived road health score.

    The scoring uses:
    - defect type severity
    - detection confidence
    - diminishing returns for repeated defects of the same type

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

    # Group confidence values by defect type
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

        # Average confidence represents how strongly
        # the model believes this defect type is present.
        average_confidence = sum(confidences) / count

        # Diminishing returns:
        # 1 defect  -> 1.00
        # 2 defects -> 1.41
        # 4 defects -> 2.00
        # 9 defects -> 3.00
        #
        # This prevents repeated video tracks from
        # destroying the score too quickly.
        count_factor = sqrt(count)

        penalty = weight * average_confidence * count_factor

        total_penalty += penalty

    score = max(
        0,
        min(
            100,
            round(100 - total_penalty)
        )
    )

    if score >= 80:
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
        "damage_count": len(detections),
        "damage_breakdown": dict(breakdown),
        "penalty": round(total_penalty, 2),
    }