"""ROBI points calculator (official IWF cross-category scoring metric).

The ROBI system was introduced by the IWF in 2018 (named after former IWF
Technology Director Robert Nagy, 'Robi') to replace Sinclair as the primary
cross-category comparison. For a given bodyweight category, a result equal to
the world-record total scores exactly 1000 points; every other total scales
via a power-law curve anchored to that world record.

Formula
-------

    ROBI = A * Total^b

where
    b = 3.3219281  (progressivity; this is log2(10), so doubling the total
                    multiplies the ROBI score by 10)
    A = 1000 / WR_total^b   (class/gender-specific, so WR scores 1000)

Equivalent form (the one this module computes with for numerical clarity):

    ROBI = 1000 * (Total / WR_total)^b

Sources
-------

Formula description: https://iwf.sport/results/robi-points/
Current world-record totals: the IWF maintains the canonical list at
    https://iwf.sport/results/world-records/
The table below was cross-checked against the post-2025-World-Championships
(Forde, Norway, October 2025) records summary on Wikipedia's
List_of_world_records_in_Olympic_weightlifting.

Policy for 'world standards'
----------------------------

Several of the current (post-Paris-2024) categories have no established
world record yet; the IWF instead sets a 'world standard' that must be
beaten to establish the first WR. Those standards are the canonical ROBI
anchor for those classes, so the table below stores them as-if they were
records -- the calculator's output is identical in either case.

Keeping the table here (not in migrations) because these change roughly
every major championship; refreshing is a ~5-line edit, not a schema
change.
"""
from __future__ import annotations

from math import log2
from typing import Union

# Progressivity constant. Hard-coded to match the value the IWF rule book
# publishes (3.3219281); log2(10) is the exact mathematical equivalent.
PROGRESSIVITY: float = 3.3219281
assert abs(PROGRESSIVITY - log2(10)) < 1e-6  # sanity: stays in sync with the math

# (category_key, upper_bound_kg, world_record_total_kg)
# - category_key is the human-friendly label surfaced in API responses.
# - upper_bound_kg is the CEILING (inclusive) for routing by bodyweight;
#   the heaviest class uses None so any heavier athlete maps to it.
# - WR totals as of the 2025 World Championships; update when IWF publishes a
#   new record or world standard.
MEN_CATEGORIES: list[tuple[str, Union[float, None], int]] = [
    ('60',   60,   307),
    ('65',   65,   324),
    ('71',   71,   347),
    ('79',   79,   365),
    ('88',   88,   387),   # Yeison Lopez (COL), 2025 Worlds
    ('94',   94,   396),
    ('110',  110,  428),
    ('+110', None, 477),
]

WOMEN_CATEGORIES: list[tuple[str, Union[float, None], int]] = [
    ('48',   48,   213),
    ('53',   53,   223),
    ('58',   58,   236),
    ('63',   63,   253),
    ('69',   69,   270),   # Song Kuk-hyang (PRK), 2025 Worlds
    ('77',   77,   278),   # Olivia Reeves (USA), 2025 Worlds
    ('86',   86,   289),
    ('+86',  None, 325),
]


def _table_for(gender: str) -> list[tuple[str, Union[float, None], int]]:
    g = (gender or '').strip().upper()
    if g == 'M':
        return MEN_CATEGORIES
    if g == 'F':
        return WOMEN_CATEGORIES
    raise ValueError(f"gender must be 'M' or 'F', got {gender!r}")


def classify(bodyweight_kg: float, gender: str) -> str:
    """Map bodyweight -> IWF category key ('60', '65', ..., '+110' or '+86').

    An athlete exactly at the boundary (e.g., 60.00 kg male) maps to the
    class they just make weight for (60). Anyone above the heaviest finite
    class goes to the +heavy bucket.
    """
    if bodyweight_kg is None or bodyweight_kg <= 0:
        raise ValueError('bodyweight_kg must be positive')
    for key, upper, _wr in _table_for(gender):
        if upper is None or bodyweight_kg <= upper:
            return key
    # _table_for guarantees a None-upper catchall, so this is unreachable.
    return _table_for(gender)[-1][0]


def world_record_total(gender: str, category_key: str) -> int:
    for key, _upper, wr in _table_for(gender):
        if key == category_key:
            return wr
    raise KeyError(f"Unknown IWF category {category_key!r} for gender {gender!r}")


def robi_score(total_kg: float, bodyweight_kg: float, gender: str) -> dict:
    """Compute a ROBI score breakdown for one athlete performance.

    Returns a dict ready for JSON serialization; no Django imports here so
    this module is trivially unit-testable without the app stack.
    """
    if total_kg is None or total_kg <= 0:
        raise ValueError('total_kg must be positive')
    category_key = classify(bodyweight_kg, gender)
    wr = world_record_total(gender, category_key)
    ratio = float(total_kg) / float(wr)
    robi = 1000.0 * (ratio ** PROGRESSIVITY)
    # A is published alongside ROBI scores in IWF communiques so we return it
    # too. A = 1000 / WR^b.
    a_coefficient = 1000.0 / (float(wr) ** PROGRESSIVITY)
    return {
        'gender': gender.upper(),
        'bodyweight_kg': float(bodyweight_kg),
        'total_kg': float(total_kg),
        'weight_class': category_key,
        'world_record_total': wr,
        'coefficient_a': round(a_coefficient, 10),
        'progressivity_b': PROGRESSIVITY,
        'robi': round(robi, 2),
    }
