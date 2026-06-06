"""
symptom_extractor.py
--------------------
Converts patient free-text into the 132-column binary vector
expected by the RandomForest disease classifier.

Three extraction methods are combined:
  1. Direct column-name substring matching
  2. Synonym dictionary matching (English / French / Kinyarwanda)
  3. Body-map region → symptom expansion
"""
from __future__ import annotations

import json
import os
import re
from typing import Any

# Negation window: look back up to 40 characters before a matched phrase
_NEG_RE = re.compile(r"\b(no|not|don'?t|without|sans|nta|never|aucun)\b")

# ── load symptom column order once at import time ──────────────────────────────
_BASE_DIR   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_COLS_PATH  = os.path.join(_BASE_DIR, "models", "symptom_columns.json")

_SYMPTOM_COLUMNS: list[str] = []
if os.path.exists(_COLS_PATH):
    with open(_COLS_PATH) as _f:
        _SYMPTOM_COLUMNS = json.load(_f)

# ── synonym map (sorted by key length DESC at build-time) ─────────────────────
_RAW_SYNONYMS: dict[str, str] = {
    # English
    "sore throat":             "throat_irritation",
    "shortness of breath":     "breathlessness",
    "muscle aches":            "muscle_pain",
    "burning up":              "high_fever",
    "burning micturition":     "burning_micturition",
    "spotting urination":      "spotting_urination",
    "irregular urination":     "spotting_urination",
    "spotting":                "spotting_urination",
    "dischromic patches":      "dischromic_patches",
    "discoloured patches":     "dischromic_patches",
    "skin patches":            "dischromic_patches",
    "foul smell of urine":     "foul_smell_of_urine",
    "smelly urine":            "foul_smell_of_urine",
    "pain during bowel":       "pain_during_bowel_movements",
    "pain in anal":            "pain_in_anal_region",
    "bloody stool":            "bloody_stool",
    "blood in stool":          "bloody_stool",
    "blurred vision":          "blurred_and_distorted_vision",
    "cant see clearly":        "blurred_and_distorted_vision",
    "cannot see clearly":      "blurred_and_distorted_vision",
    "loss of appetite":        "loss_of_appetite",
    "no appetite":             "loss_of_appetite",
    "not hungry":              "loss_of_appetite",
    "cant eat":                "loss_of_appetite",
    "cannot eat":              "loss_of_appetite",
    "difficulty breathing":    "breathlessness",
    "short of breath":         "breathlessness",
    "hard to breathe":         "breathlessness",
    "cant breathe":            "breathlessness",
    "cannot breathe":          "breathlessness",
    "loss of smell":           "loss_of_smell",
    "cant smell":              "loss_of_smell",
    "cannot smell":            "loss_of_smell",
    "frequent urination":      "polyuria",
    "urinating a lot":         "polyuria",
    "night sweats":            "sweating",
    "feeling cold":            "chills",
    "feeling depressed":       "depression",
    "chest tightness":         "chest_pain",
    "chest pressure":          "chest_pain",
    "chest pain":              "chest_pain",
    "heart racing":            "fast_heart_rate",
    "fast heartbeat":          "fast_heart_rate",
    "loose stool":             "diarrhoea",
    "watery stool":            "diarrhoea",
    "runny stomach":           "diarrhoea",
    "stomach ache":            "stomach_pain",
    "stomach pain":            "stomach_pain",
    "abdominal pain":          "abdominal_pain",
    "tummy pain":              "abdominal_pain",
    "belly pain":              "belly_pain",
    "joint ache":              "joint_pain",
    "joint pain":              "joint_pain",
    "painful joints":          "joint_pain",
    "joint swelling":          "swelling_joints",
    "swollen joints":          "swelling_joints",
    "swollen legs":            "swollen_legs",
    "legs swollen":            "swollen_legs",
    "skin turned yellow":      "yellowish_skin",
    "yellow skin":             "yellowish_skin",
    "eyes turned yellow":      "yellowing_of_eyes",
    "yellow eyes":             "yellowing_of_eyes",
    "back pain":               "back_pain",
    "neck pain":               "neck_pain",
    "stiff neck":              "stiff_neck",
    "muscle pain":             "muscle_pain",
    "body aches":              "muscle_pain",
    "body pain":               "muscle_pain",
    "muscles hurt":            "muscle_pain",
    "weight gain":             "weight_gain",
    "gaining weight":          "weight_gain",
    "weight loss":             "weight_loss",
    "losing weight":           "weight_loss",
    "throwing up":             "vomiting",
    "threw up":                "vomiting",
    "skin peeling":            "skin_peeling",
    "skin rash":               "skin_rash",
    "red eyes":                "redness_of_eyes",
    "watery eyes":             "watering_from_eyes",
    "runny nose":              "runny_nose",
    "nose running":            "runny_nose",
    "blocked nose":            "congestion",
    "dark urine":              "dark_urine",
    "brown urine":             "dark_urine",
    "no energy":               "fatigue",
    "head ache":               "headache",
    "head pain":               "headache",
    "acid reflux":             "acidity",
    "increased hunger":        "excessive_hunger",
    "always hungry":           "excessive_hunger",
    "family history":          "family_history",
    "pus filled":              "pus_filled_pimples",
    "slight fever":            "mild_fever",
    "low fever":               "mild_fever",
    "breathless":              "breathlessness",
    "exhausted":               "fatigue",
    "tiredness":               "fatigue",
    "weakness":                "fatigue",
    "spinning":                "dizziness",
    "lightheaded":             "dizziness",
    "dizziness":               "dizziness",
    "constipation":            "constipation",
    "indigestion":             "indigestion",
    "heartburn":               "indigestion",
    "palpitations":            "palpitations",
    "blackheads":              "blackheads",
    "bruising":                "bruising",
    "bruises":                 "bruising",
    "dehydration":             "dehydration",
    "very thirsty":            "dehydration",
    "temperature":             "high_fever",
    "coughing":                "cough",
    "sneezing":                "continuous_sneezing",
    "shivering":               "shivering",
    "trembling":               "shivering",
    "shaking":                 "shivering",
    "sweating":                "sweating",
    "sweaty":                  "sweating",
    "jaundice":                "yellowish_skin",
    "migraine":                "headache",
    "anxious":                 "anxiety",
    "congestion":              "congestion",
    "phlegm":                  "phlegm",
    "mucus":                   "phlegm",
    "sputum":                  "phlegm",
    "vomit":                   "vomiting",
    "nausea":                  "nausea",
    "queasy":                  "nausea",
    "rash":                    "skin_rash",
    "itchy":                   "itching",
    "fever":                   "high_fever",
    "tired":                   "fatigue",
    "diarrhea":                "diarrhoea",
    "diarrhoea":               "diarrhoea",
    "cough":                   "cough",
    "itching":                 "itching",
    "itch":                    "itching",
    "chills":                  "chills",
    "anxiety":                 "anxiety",
    "depression":              "depression",
    "obesity":                 "obesity",
    "acidity":                 "acidity",
    "headache":                "headache",
    "dizzy":                   "dizziness",
    "backache":                "back_pain",
    "feel sick":               "nausea",
    "pus":                     "pus_filled_pimples",
    "insomnia":                "restlessness",
    "can't sleep":             "restlessness",
    "cannot sleep":            "restlessness",
    "trouble sleeping":        "restlessness",
    "sleep problems":          "restlessness",
    "ear pain":                "pain_behind_the_eyes",
    "earache":                 "pain_behind_the_eyes",
    "ear ache":                "pain_behind_the_eyes",
    "pain in ear":             "pain_behind_the_eyes",
    "throat pain":             "throat_irritation",
    "painful throat":          "throat_irritation",
    "muscle weakness":         "muscle_weakness",
    "weak muscles":            "muscle_weakness",
    "loss of balance":         "loss_of_balance",
    "unsteady":                "unsteadiness",

    # ── Previously unreachable symptoms (62 model columns now mapped) ─────────

    # nodal_skin_eruptions
    "skin nodules":            "nodal_skin_eruptions",
    "nodal eruptions":         "nodal_skin_eruptions",
    "lumps on skin":           "nodal_skin_eruptions",
    "skin bumps":              "nodal_skin_eruptions",
    "raised skin bumps":       "nodal_skin_eruptions",

    # muscle_wasting
    "muscle wasting":          "muscle_wasting",
    "muscle loss":             "muscle_wasting",
    "muscles shrinking":       "muscle_wasting",
    "muscle atrophy":          "muscle_wasting",

    # cold_hands_and_feets
    "cold hands and feet":     "cold_hands_and_feets",
    "cold hands":              "cold_hands_and_feets",
    "cold feet":               "cold_hands_and_feets",
    "cold extremities":        "cold_hands_and_feets",
    "hands and feet cold":     "cold_hands_and_feets",

    # mood_swings
    "mood swings":             "mood_swings",
    "mood changes":            "mood_swings",
    "emotional swings":        "mood_swings",
    "emotional changes":       "mood_swings",

    # lethargy
    "lethargy":                "lethargy",
    "lethargic":               "lethargy",
    "sluggish":                "lethargy",
    "no motivation":           "lethargy",

    # patches_in_throat
    "patches in throat":       "patches_in_throat",
    "white patches throat":    "patches_in_throat",
    "throat patches":          "patches_in_throat",
    "spots in throat":         "patches_in_throat",

    # irregular_sugar_level
    "irregular sugar level":   "irregular_sugar_level",
    "blood sugar fluctuation":  "irregular_sugar_level",
    "sugar level irregular":    "irregular_sugar_level",
    "fluctuating sugar":        "irregular_sugar_level",

    # sunken_eyes
    "sunken eyes":             "sunken_eyes",
    "hollow eyes":             "sunken_eyes",
    "eyes look hollow":        "sunken_eyes",
    "deep set eyes":           "sunken_eyes",

    # acute_liver_failure
    "acute liver failure":     "acute_liver_failure",
    "liver failure":           "acute_liver_failure",
    "liver not working":       "acute_liver_failure",

    # fluid_overload / fluid_overload.1
    "fluid overload":          "fluid_overload",
    "fluid retention":         "fluid_overload",
    "fluid buildup":           "fluid_overload",
    "water retention":         "fluid_overload",
    "body retaining fluid":    "fluid_overload",

    # swelling_of_stomach
    "swelling of stomach":     "swelling_of_stomach",
    "stomach swelling":        "swelling_of_stomach",
    "swollen stomach":         "swelling_of_stomach",
    "stomach bloated":         "swelling_of_stomach",
    "belly swollen":           "swelling_of_stomach",

    # swelled_lymph_nodes
    "swelled lymph nodes":     "swelled_lymph_nodes",
    "swollen glands":          "swelled_lymph_nodes",
    "swollen lymph nodes":     "swelled_lymph_nodes",
    "lymph nodes swollen":     "swelled_lymph_nodes",
    "glands swollen":          "swelled_lymph_nodes",
    "enlarged lymph nodes":    "swelled_lymph_nodes",

    # malaise
    "malaise":                 "malaise",
    "general malaise":         "malaise",
    "feeling unwell":          "malaise",
    "not feeling well":        "malaise",
    "generally unwell":        "malaise",

    # sinus_pressure
    "sinus pressure":          "sinus_pressure",
    "sinus pain":              "sinus_pressure",
    "sinus congestion":        "sinus_pressure",
    "pressure in sinuses":     "sinus_pressure",
    "face pressure":           "sinus_pressure",

    # irritation_in_anus
    "irritation in anus":      "irritation_in_anus",
    "anal irritation":         "irritation_in_anus",
    "rectal itching":          "irritation_in_anus",
    "anal itching":            "irritation_in_anus",
    "itching in anus":         "irritation_in_anus",

    # cramps
    "cramps":                  "cramps",
    "muscle cramps":           "cramps",
    "cramping":                "cramps",
    "stomach cramps":          "cramps",
    "leg cramps":              "cramps",

    # swollen_blood_vessels
    "swollen blood vessels":   "swollen_blood_vessels",
    "swollen veins":           "swollen_blood_vessels",
    "varicose veins":          "swollen_blood_vessels",
    "bulging veins":           "swollen_blood_vessels",

    # puffy_face_and_eyes
    "puffy face and eyes":     "puffy_face_and_eyes",
    "puffy face":              "puffy_face_and_eyes",
    "face puffiness":          "puffy_face_and_eyes",
    "puffy eyes":              "puffy_face_and_eyes",
    "facial swelling":         "puffy_face_and_eyes",
    "swollen face":            "puffy_face_and_eyes",

    # enlarged_thyroid
    "enlarged thyroid":        "enlarged_thyroid",
    "thyroid swelling":        "enlarged_thyroid",
    "goiter":                  "enlarged_thyroid",
    "goitre":                  "enlarged_thyroid",
    "swollen thyroid":         "enlarged_thyroid",
    "neck lump":               "enlarged_thyroid",

    # brittle_nails
    "brittle nails":           "brittle_nails",
    "nails brittle":           "brittle_nails",
    "weak nails":              "brittle_nails",
    "nails breaking":          "brittle_nails",
    "nails cracking":          "brittle_nails",

    # extra_marital_contacts
    "extra marital contacts":  "extra_marital_contacts",
    "multiple partners":       "extra_marital_contacts",
    "unprotected sex":         "extra_marital_contacts",
    "unprotected intercourse": "extra_marital_contacts",

    # drying_and_tingling_lips
    "drying and tingling lips": "drying_and_tingling_lips",
    "dry and tingling lips":   "drying_and_tingling_lips",
    "tingling lips":           "drying_and_tingling_lips",
    "dry cracked lips":        "drying_and_tingling_lips",
    "lips tingling":           "drying_and_tingling_lips",
    "lips dry":                "drying_and_tingling_lips",

    # slurred_speech
    "slurred speech":          "slurred_speech",
    "difficulty speaking":     "slurred_speech",
    "speech slurred":          "slurred_speech",
    "can't speak clearly":     "slurred_speech",
    "cannot speak clearly":    "slurred_speech",
    "talking difficulty":      "slurred_speech",

    # knee_pain
    "knee pain":               "knee_pain",
    "knee ache":               "knee_pain",
    "painful knee":            "knee_pain",
    "knees hurt":              "knee_pain",
    "sore knee":               "knee_pain",

    # hip_joint_pain
    "hip pain":                "hip_joint_pain",
    "hip joint pain":          "hip_joint_pain",
    "hip ache":                "hip_joint_pain",
    "painful hip":             "hip_joint_pain",
    "hips hurt":               "hip_joint_pain",

    # movement_stiffness
    "movement stiffness":      "movement_stiffness",
    "stiff movements":         "movement_stiffness",
    "stiffness":               "movement_stiffness",
    "rigid joints":            "movement_stiffness",
    "difficulty moving":       "movement_stiffness",
    "hard to move":            "movement_stiffness",

    # spinning_movements
    "spinning movements":      "spinning_movements",
    "room spinning":           "spinning_movements",
    "world spinning":          "spinning_movements",
    "vertigo":                 "spinning_movements",
    "spinning sensation":      "spinning_movements",

    # weakness_of_one_body_side
    "weakness of one side":    "weakness_of_one_body_side",
    "one sided weakness":      "weakness_of_one_body_side",
    "half body weak":          "weakness_of_one_body_side",
    "one side weak":           "weakness_of_one_body_side",
    "arm weakness one side":   "weakness_of_one_body_side",

    # bladder_discomfort
    "bladder discomfort":      "bladder_discomfort",
    "bladder pain":            "bladder_discomfort",
    "painful bladder":         "bladder_discomfort",
    "discomfort in bladder":   "bladder_discomfort",
    "bladder pressure":        "bladder_discomfort",

    # continuous_feel_of_urine
    "continuous feel of urine": "continuous_feel_of_urine",
    "constant urge to urinate": "continuous_feel_of_urine",
    "always feel like urinating": "continuous_feel_of_urine",
    "urge to urinate":          "continuous_feel_of_urine",
    "can't stop urinating":     "continuous_feel_of_urine",
    "feels like urinating":     "continuous_feel_of_urine",

    # passage_of_gases
    "passage of gases":        "passage_of_gases",
    "gas passing":             "passage_of_gases",
    "flatulence":              "passage_of_gases",
    "intestinal gas":          "passage_of_gases",
    "bloating":                "passage_of_gases",
    "passing gas":             "passage_of_gases",
    "gassy":                   "passage_of_gases",

    # internal_itching
    "internal itching":        "internal_itching",
    "itching inside":          "internal_itching",
    "internal itch":           "internal_itching",
    "deep itching":            "internal_itching",

    # toxic_look_(typhos)
    "toxic appearance":        "toxic_look_(typhos)",
    "very ill looking":        "toxic_look_(typhos)",
    "severely ill appearance": "toxic_look_(typhos)",
    "typhoid look":            "toxic_look_(typhos)",

    # irritability
    "irritability":            "irritability",
    "irritable":               "irritability",
    "easily irritated":        "irritability",
    "short tempered":          "irritability",
    "easily angered":          "irritability",

    # altered_sensorium (English — Kinyarwanda already covered)
    "altered sensorium":       "altered_sensorium",
    "confusion":               "altered_sensorium",
    "confused":                "altered_sensorium",
    "disoriented":             "altered_sensorium",
    "disorientation":          "altered_sensorium",
    "not knowing where i am":  "altered_sensorium",
    "mental confusion":        "altered_sensorium",

    # red_spots_over_body
    "red spots over body":     "red_spots_over_body",
    "red spots on body":       "red_spots_over_body",
    "red dots on skin":        "red_spots_over_body",
    "red spots":               "red_spots_over_body",
    "red dot rash":            "red_spots_over_body",

    # abnormal_menstruation
    "abnormal menstruation":   "abnormal_menstruation",
    "irregular periods":       "abnormal_menstruation",
    "menstrual irregularity":  "abnormal_menstruation",
    "abnormal periods":        "abnormal_menstruation",
    "missed periods":          "abnormal_menstruation",
    "heavy periods":           "abnormal_menstruation",

    # increased_appetite
    "increased appetite":      "increased_appetite",
    "eating more than usual":  "increased_appetite",
    "appetite increased":      "increased_appetite",
    "more hungry than usual":  "increased_appetite",

    # mucoid_sputum
    "mucoid sputum":           "mucoid_sputum",
    "thick mucus sputum":      "mucoid_sputum",
    "thick phlegm":            "mucoid_sputum",
    "green phlegm":            "mucoid_sputum",
    "cloudy sputum":           "mucoid_sputum",

    # rusty_sputum
    "rusty sputum":            "rusty_sputum",
    "rust colored sputum":     "rusty_sputum",
    "brown sputum":            "rusty_sputum",
    "rusty phlegm":            "rusty_sputum",
    "reddish sputum":          "rusty_sputum",

    # lack_of_concentration
    "lack of concentration":   "lack_of_concentration",
    "can't concentrate":       "lack_of_concentration",
    "cannot concentrate":      "lack_of_concentration",
    "difficulty concentrating": "lack_of_concentration",
    "poor concentration":      "lack_of_concentration",
    "brain fog":               "lack_of_concentration",
    "trouble focusing":        "lack_of_concentration",

    # visual_disturbances
    "visual disturbances":     "visual_disturbances",
    "vision problems":         "visual_disturbances",
    "disturbed vision":        "visual_disturbances",
    "sight problems":          "visual_disturbances",
    "seeing things":           "visual_disturbances",
    "vision disturbance":      "visual_disturbances",

    # receiving_blood_transfusion
    "blood transfusion":       "receiving_blood_transfusion",
    "received blood transfusion": "receiving_blood_transfusion",
    "had blood transfusion":   "receiving_blood_transfusion",

    # receiving_unsterile_injections
    "unsterile injections":    "receiving_unsterile_injections",
    "dirty needle":            "receiving_unsterile_injections",
    "unsterilised injection":  "receiving_unsterile_injections",
    "unsafe injection":        "receiving_unsterile_injections",
    "shared needle":           "receiving_unsterile_injections",

    # coma
    "coma":                    "coma",
    "unconscious":             "coma",
    "unresponsive":            "coma",
    "lost consciousness":      "coma",
    "not conscious":           "coma",

    # stomach_bleeding
    "stomach bleeding":        "stomach_bleeding",
    "gastric bleeding":        "stomach_bleeding",
    "bleeding stomach":        "stomach_bleeding",
    "internal stomach bleed":  "stomach_bleeding",
    "vomiting blood":          "stomach_bleeding",

    # distention_of_abdomen
    "distention of abdomen":   "distention_of_abdomen",
    "distended abdomen":       "distention_of_abdomen",
    "abdominal distension":    "distention_of_abdomen",
    "abdomen distended":       "distention_of_abdomen",
    "belly distended":         "distention_of_abdomen",

    # history_of_alcohol_consumption
    "history of alcohol":      "history_of_alcohol_consumption",
    "drinks alcohol":          "history_of_alcohol_consumption",
    "alcohol consumption":     "history_of_alcohol_consumption",
    "alcoholic":               "history_of_alcohol_consumption",
    "heavy drinker":           "history_of_alcohol_consumption",
    "drinks heavily":          "history_of_alcohol_consumption",

    # blood_in_sputum
    "blood in sputum":         "blood_in_sputum",
    "coughing blood":          "blood_in_sputum",
    "blood when coughing":     "blood_in_sputum",
    "bloody sputum":           "blood_in_sputum",
    "blood in mucus":          "blood_in_sputum",
    "haemoptysis":             "blood_in_sputum",

    # prominent_veins_on_calf
    "prominent veins on calf": "prominent_veins_on_calf",
    "visible veins calf":      "prominent_veins_on_calf",
    "bulging calf veins":      "prominent_veins_on_calf",
    "calf veins visible":      "prominent_veins_on_calf",

    # painful_walking
    "painful walking":         "painful_walking",
    "pain when walking":       "painful_walking",
    "hurts to walk":           "painful_walking",
    "difficulty walking":      "painful_walking",
    "walking is painful":      "painful_walking",

    # scurring (skin scaling / flaking artifact from dataset)
    "scurring":                "scurring",
    "skin scaling":            "scurring",
    "skin flaking":            "scurring",
    "scaly skin":              "scurring",
    "flaking skin":            "scurring",

    # silver_like_dusting
    "silver like dusting":     "silver_like_dusting",
    "silvery skin":            "silver_like_dusting",
    "silver scales on skin":   "silver_like_dusting",
    "silver patches":          "silver_like_dusting",

    # small_dents_in_nails
    "small dents in nails":    "small_dents_in_nails",
    "nail pitting":            "small_dents_in_nails",
    "dents in nails":          "small_dents_in_nails",
    "nail dents":              "small_dents_in_nails",
    "pitted nails":            "small_dents_in_nails",

    # inflammatory_nails
    "inflammatory nails":      "inflammatory_nails",
    "inflamed nails":          "inflammatory_nails",
    "nail inflammation":       "inflammatory_nails",
    "swollen nail bed":        "inflammatory_nails",

    # blister
    "blister":                 "blister",
    "blisters":                "blister",
    "skin blisters":           "blister",
    "fluid filled blisters":   "blister",
    "water blisters":          "blister",

    # red_sore_around_nose
    "red sore around nose":    "red_sore_around_nose",
    "sore around nose":        "red_sore_around_nose",
    "nose sore":               "red_sore_around_nose",
    "redness around nose":     "red_sore_around_nose",

    # yellow_crust_ooze
    "yellow crust ooze":       "yellow_crust_ooze",
    "yellow discharge":        "yellow_crust_ooze",
    "yellow crusting":         "yellow_crust_ooze",
    "yellow ooze":             "yellow_crust_ooze",
    "crusty yellow skin":      "yellow_crust_ooze",

    # yellow_urine
    "yellow urine":            "yellow_urine",
    "bright yellow urine":     "yellow_urine",
    "very yellow pee":         "yellow_urine",
    "urine bright yellow":     "yellow_urine",

    # swollen_extremeties (different from swollen_legs)
    "swollen extremities":     "swollen_extremeties",
    "swollen hands and feet":  "swollen_extremeties",
    "extremities swollen":     "swollen_extremeties",
    "hands and feet swollen":  "swollen_extremeties",

    # Remaining 3 previously unreachable columns
    "ulcers on tongue":        "ulcers_on_tongue",
    "tongue ulcers":           "ulcers_on_tongue",
    "mouth ulcers":            "ulcers_on_tongue",
    "tongue sores":            "ulcers_on_tongue",
    "sores on tongue":         "ulcers_on_tongue",
    "weakness in limbs":       "weakness_in_limbs",
    "weak limbs":              "weakness_in_limbs",
    "limb weakness":           "weakness_in_limbs",
    "arms and legs weak":      "weakness_in_limbs",

    # French — new symptom coverage
    "crampes":                 "cramps",
    "ballonnement":            "passage_of_gases",
    "gaz intestinaux":         "passage_of_gases",
    "vision trouble":          "visual_disturbances",
    "vision perturbée":        "visual_disturbances",
    "ganglions gonflés":       "swelled_lymph_nodes",
    "vertiges rotatoires":     "spinning_movements",
    "raideur musculaire":      "movement_stiffness",
    "crachats rouillés":       "rusty_sputum",
    "sang dans les crachats":  "blood_in_sputum",
    "saignement estomac":      "stomach_bleeding",

    # French
    "forte fièvre":            "high_fever",
    "douleur thoracique":      "chest_pain",
    "douleur poitrine":        "chest_pain",
    "douleurs musculaires":    "muscle_pain",
    "douleurs articulaires":   "joint_pain",
    "perte de poids":          "weight_loss",
    "perte appétit":           "loss_of_appetite",
    "yeux jaunes":             "yellowing_of_eyes",
    "peau jaune":              "yellowish_skin",
    "nez qui coule":           "runny_nose",
    "mal de gorge":            "throat_irritation",
    "urine foncée":            "dark_urine",
    "maux de tête":            "headache",
    "vomissements":            "vomiting",
    "essoufflement":           "breathlessness",
    "éruption cutanée":        "skin_rash",
    "céphalée":                "headache",
    "diarrhée":                "diarrhoea",
    "constipation":            "constipation",
    "nausées":                 "nausea",
    "frissons":                "chills",
    "fatigue":                 "fatigue",
    "vertiges":                "dizziness",
    "sueurs":                  "sweating",
    "fièvre":                  "high_fever",
    "vomir":                   "vomiting",
    "toux":                    "cough",

    # ── Kinyarwanda ───────────────────────────────────────────────────────────
    # Fever & temperature
    "umuriro mwinshi":         "high_fever",
    "umuriro muke":            "mild_fever",
    "umuriro":                 "high_fever",
    "ubushyuhe":               "high_fever",

    # Respiratory
    "ibibazo byo guhumeka":    "breathlessness",
    "guhumeka nabi":           "breathlessness",
    "guhumeka bigoye":         "breathlessness",
    "inkorora isuwe":          "cough",
    "inkorora":                "cough",
    "amaflegm":                "phlegm",
    "ibyango":                 "congestion",
    "guhuha kenshi":           "continuous_sneezing",
    "guhuha":                  "continuous_sneezing",

    # Head & neuro
    "kuribwa umutwe bikabije": "headache",
    "kuribwa umutwe":          "headache",
    "ikiribwa":                "headache",
    "umutwe uribwa":           "headache",
    "umutwe":                  "headache",
    "guhindagirana":           "dizziness",
    "gusimbagira":             "dizziness",
    "kurindagira":             "dizziness",
    "gusahurana":              "altered_sensorium",
    "gutakaza ubwenge":        "altered_sensorium",

    # Chest & cardiac
    "ububabare bw'igituza":    "chest_pain",
    "kubabara igituza":        "chest_pain",
    "ubuganga":                "chest_pain",
    "umutima ugenda vuba":     "fast_heart_rate",
    "umutima utera vuba":      "fast_heart_rate",
    "ubukangurambaga":         "palpitations",

    # GI — upper
    "isesemi":                 "nausea",
    "kuririmba":               "nausea",
    "guseseka":                "vomiting",
    "gutura":                  "vomiting",
    "kuruka":                  "vomiting",
    "gutera umurego":          "vomiting",
    "kuribwa igifu":           "stomach_pain",
    "inda iribwa":             "abdominal_pain",
    "kubabara inda":           "abdominal_pain",
    "ububabare bw'inda":       "abdominal_pain",

    # GI — lower
    "guhitwa":                 "diarrhoea",
    "gusurura":                "diarrhoea",
    "gucurika":                "diarrhoea",
    "amaraso mu nkari":        "bloody_stool",
    "inkari y'amaraso":        "bloody_stool",
    "kunena":                  "constipation",

    # Musculoskeletal
    "ububabare bw'ingingo":    "joint_pain",
    "uburibwe bw'ingingo":     "joint_pain",
    "kubabara ingingo":        "joint_pain",
    "amenyo":                  "joint_pain",
    "ububabare bw'umubiri":    "muscle_pain",
    "uburibwe bw'umubiri":     "muscle_pain",
    "uburirane":               "muscle_pain",
    "kubabara umugongo":       "back_pain",
    "kuribwa umugongo":        "back_pain",
    "ububabare bw'umugongo":   "back_pain",
    "kubabara izosi":          "neck_pain",
    "izosi iboze":             "stiff_neck",
    "inshinge y'izosi":        "stiff_neck",

    # Skin & eyes
    "impanga":                 "skin_rash",
    "gukangara":               "skin_rash",
    "ubukangara":              "skin_rash",
    "gushyitwa":               "itching",
    "kuribwa ubwoya":          "itching",
    "ibara ry'umuhondo":       "yellowish_skin",
    "indwara y'uruyuki":       "yellowish_skin",
    "amaso y'umuhondo":        "yellowing_of_eyes",
    "amaso akunze guribwa":    "redness_of_eyes",

    # Kinyarwanda — additional coverage
    "guhangayika":             "anxiety",
    "kwiheba":                 "depression",
    "agahinda":                "depression",
    "amaso atareba neza":      "blurred_and_distorted_vision",
    "kubona nabi":             "blurred_and_distorted_vision",
    "gukorwa umuhogo":         "throat_irritation",
    "umuhogo uribwa":          "throat_irritation",
    "uburibwe bw'imishikaro":  "muscle_pain",
    "kutidindira":             "restlessness",
    "nzoka y'amazuru":         "runny_nose",
    "kubabara ugutwi":         "pain_behind_the_eyes",  # closest proxy; ear_pain not in model

    # Systemic
    "kunanirwa":               "fatigue",
    "guhebuka":                "fatigue",
    "uburuhe":                 "fatigue",
    "umunaniro":               "fatigue",
    "gucika intege":           "fatigue",
    "uburwayi":                "fatigue",
    "guterera":                "shivering",
    "gukangarika":             "shivering",
    "kurota cyane":            "sweating",
    "gukonja":                 "chills",
    "gutakaza inzara":         "loss_of_appetite",
    "kutagira inzara":         "loss_of_appetite",
    "kugabanuka ibiro":        "weight_loss",
    "kongera ibiro":           "weight_gain",
    "gukenyera":               "dehydration",
    "inyota ikabije":          "dehydration",
}

# Sort by key length descending so longer phrases match first
_SYNONYMS: list[tuple[str, str]] = sorted(
    _RAW_SYNONYMS.items(), key=lambda kv: len(kv[0]), reverse=True
)

# ── body map → symptom expansion ─────────────────────────────────────────────
_BODY_MAP: dict[str, str] = {
    "chest":   "chest_pain",
    "head":    "headache",
    "stomach": "stomach_pain",
    "abdomen": "abdominal_pain",
    "back":    "back_pain",
    "joints":  "joint_pain",
    "skin":    "skin_rash",
    "eyes":    "redness_of_eyes",
    "throat":  "throat_irritation",
    "legs":    "swollen_legs",
}


# ── public API ─────────────────────────────────────────────────────────────────

def extract_symptoms(
    text: str,
    language: str = "en",
    body_map_data: dict[str, Any] | None = None,
    structured_symptoms: list[str] | None = None,
) -> dict:
    """
    Extract symptoms from free text + optional body-map regions + optional
    pre-parsed symptom list from the frontend.

    Returns:
        {
            'symptom_vector'    : list[int]  (length == 132),
            'detected_symptoms' : list[str],
            'symptom_count'     : int,
        }
    """
    if not _SYMPTOM_COLUMNS:
        _load_columns()

    detected: set[str] = set()
    lower_text = text.lower() if text else ""

    # ── Method 0 — structured symptom list from frontend (highest priority) ───
    if structured_symptoms:
        for sym in structured_symptoms:
            # Normalise: lowercase + spaces → underscores
            col = str(sym).lower().replace(" ", "_")
            if col in _SYMPTOM_COLUMNS:
                detected.add(col)
            else:
                # Try synonym lookup for frontend display labels
                for phrase, mapped_col in _SYNONYMS:
                    if phrase == str(sym).lower() and mapped_col in _SYMPTOM_COLUMNS:
                        detected.add(mapped_col)
                        break

    # ── Method 1 + 2 combined (synonyms first, then direct names) ─────────────
    # Work on a copy of the text we progressively "consume" to avoid double-hits
    working = lower_text
    negated: set[str] = set()

    # Method 2 — synonym matching (longer keys first)
    for phrase, col_name in _SYNONYMS:
        if phrase in working and col_name in _SYMPTOM_COLUMNS:
            idx = working.find(phrase)
            prefix = working[max(0, idx - 40): idx]
            if _NEG_RE.search(prefix):
                negated.add(col_name)
            else:
                detected.add(col_name)
            # blank out matched phrase to avoid double-matching substrings
            working = working.replace(phrase, " " * len(phrase), 1)

    # Method 1 — direct column-name matching (spaces replaced by underscores)
    for col in _SYMPTOM_COLUMNS:
        col_spaced = col.replace("_", " ")      # e.g. "high_fever" → "high fever"
        if col in lower_text or col_spaced in lower_text:
            idx = lower_text.find(col_spaced if col_spaced in lower_text else col)
            prefix = lower_text[max(0, idx - 40): idx]
            if _NEG_RE.search(prefix):
                negated.add(col)
            else:
                detected.add(col)

    # Remove anything explicitly negated
    detected -= negated

    # ── Method 3 — body map ───────────────────────────────────────────────────
    if body_map_data:
        # Support both flat {"chest": true} and {"regions": ["chest"]} formats
        regions_list = body_map_data.get("regions")
        if isinstance(regions_list, list):
            regions = regions_list
        else:
            # Flat dict: extract keys whose value is truthy (skip "severity" meta key)
            regions = [k for k, v in body_map_data.items() if v and k != "severity"]
        for region in regions:
            mapped = _BODY_MAP.get(str(region).lower())
            if mapped and mapped in _SYMPTOM_COLUMNS:
                detected.add(mapped)

    # ── build 132-element binary vector ──────────────────────────────────────
    symptom_set = detected
    vector = [1 if col in symptom_set else 0 for col in _SYMPTOM_COLUMNS]

    return {
        "symptom_vector":    vector,
        "detected_symptoms": sorted(symptom_set),
        "symptom_count":     len(symptom_set),
    }


def _load_columns():
    """Lazy reload in case columns weren't available at import time."""
    global _SYMPTOM_COLUMNS
    if os.path.exists(_COLS_PATH):
        with open(_COLS_PATH) as f:
            _SYMPTOM_COLUMNS = json.load(f)
