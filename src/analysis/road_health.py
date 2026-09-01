from collections import Counter


DAMAGE_WEIGHTS = {
    "longitudinal crack": 8,
    "transverse crack": 9,
    "alligator crack": 14,
    "other corruption": 7,
    "pothole": 18,
}


def calculate_road_health(detections):
    """
    Calculate a 0-100 Road Health Score from YOLO detections.
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
    total_penalty = 0

    for detection in detections:
        damage_type = detection["class"]
        confidence = detection["confidence"]

        weight = DAMAGE_WEIGHTS.get(damage_type, 7)

        # Confidence-weighted damage penalty
        penalty = weight * confidence

        total_penalty += penalty
        breakdown[damage_type] += 1

    # Additional penalty for repeated defects
    for damage_type, count in breakdown.items():
        if count > 1:
            total_penalty += (count - 1) * (
                DAMAGE_WEIGHTS.get(damage_type, 7) * 0.5
            )

    score = max(0, min(100, round(100 - total_penalty)))

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