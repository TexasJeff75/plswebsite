import React, { useState } from 'react';
import { Search, Tag, FlaskConical, Dna, Wind, Activity, ChevronDown, ChevronRight } from 'lucide-react';

// ─── Pricing Data (HealthSpan360 Price List — effective March 2026) ───────────

const HS360_PRICE_LIST = [
  { section: 'CHEMISTRY PANELS' },
  { name: 'BMP — Basic Metabolic Panel', biomarkers: 'Glucose, BUN, Creatinine, eGFR, Sodium, Potassium, Chloride, CO2', clientPrice: 5.3222, retailPrice: 12 },
  { name: 'CMP — Comprehensive Metabolic Panel', biomarkers: 'BMP + Protein, Albumin, ALT, AST, ALP, Bilirubin', clientPrice: 6.9622, retailPrice: 15 },
  { name: 'Lipid Panel — Standard', biomarkers: 'Total Cholesterol, HDL, LDL (calc.), Triglycerides', clientPrice: 6.9622, retailPrice: 15 },
  { name: 'Hepatic Function Panel', biomarkers: 'ALT, AST, ALP, GGT, Total/Direct Bilirubin, Protein, Albumin', clientPrice: 6.9622, retailPrice: 15 },
  { name: 'Renal Function Panel', biomarkers: 'BUN, Creatinine, eGFR, Cystatin C, Uric Acid', clientPrice: 8.6022, retailPrice: 18 },
  { name: 'Electrolyte Panel', biomarkers: 'Sodium, Potassium, Chloride, CO2, Magnesium, Phosphorus, Calcium', clientPrice: 8.6022, retailPrice: 18 },

  { section: 'HEMATOLOGY' },
  { name: 'CBC with Differential', biomarkers: 'WBC, RBC, Hemoglobin, Hematocrit, MCV, MCH, MCHC, Platelets, Neutrophils, Lymphocytes, Monocytes, Eosinophils, Basophils', clientPrice: 5.3222, retailPrice: 12 },
  { name: 'CBC without Differential', biomarkers: 'WBC, RBC, Hemoglobin, Hematocrit, MCV, MCH, MCHC, Platelets', clientPrice: 3.6822, retailPrice: 8 },
  { name: 'Iron Studies', biomarkers: 'Serum Iron, TIBC, Ferritin, Transferrin Saturation', clientPrice: 8.6022, retailPrice: 18 },
  { name: 'Reticulocyte Count', biomarkers: 'Reticulocyte %, Absolute Reticulocyte Count', clientPrice: 5.3222, retailPrice: 12 },

  { section: 'BUNDLED WELLNESS PANELS' },
  { name: 'Essential Wellness Panel', biomarkers: 'CBC w/Diff, CMP, Lipid Panel, TSH, HbA1c, Vitamin D, Ferritin', clientPrice: 29.44, retailPrice: 65 },
  { name: 'Advanced Wellness Panel', biomarkers: 'Essential + Advanced Lipid, hsCRP, Homocysteine, Insulin, DHEA-S, Cortisol AM', clientPrice: 49.52, retailPrice: 110 },
  { name: 'Executive Health Panel', biomarkers: 'Advanced Wellness + Testosterone Total/Free, Estradiol, PSA (male) or CA-125 (female), Uric Acid, Cystatin C', clientPrice: 69.60, retailPrice: 155 },
  { name: 'Longevity & Performance Panel', biomarkers: 'Executive Health + IGF-1, SHBG, LH, FSH, ApoB, Lp(a), Omega-3 Index, Telomere Length, Heavy Metals Screen', clientPrice: 115.62, retailPrice: 260 },

  { section: 'THYROID' },
  { name: 'TSH', biomarkers: 'Thyroid Stimulating Hormone', clientPrice: 5.3222, retailPrice: 12 },
  { name: 'Free T4 (FT4)', biomarkers: 'Free Thyroxine', clientPrice: 5.3222, retailPrice: 12 },
  { name: 'Free T3 (FT3)', biomarkers: 'Free Triiodothyronine', clientPrice: 5.3222, retailPrice: 12 },
  { name: 'Total T3', biomarkers: 'Total Triiodothyronine', clientPrice: 5.3222, retailPrice: 12 },
  { name: 'Reverse T3 (rT3)', biomarkers: 'Reverse Triiodothyronine', clientPrice: 8.6022, retailPrice: 18 },
  { name: 'Anti-TPO / Anti-TG Antibodies', biomarkers: 'Thyroid Peroxidase Ab, Thyroglobulin Ab', clientPrice: 10.2422, retailPrice: 22 },
  { name: 'Thyroid Panel (Full)', biomarkers: 'TSH, FT4, FT3, Total T3, Anti-TPO, Anti-TG', clientPrice: 24.09, retailPrice: 55 },

  { section: 'HORMONE PANELS' },
  { name: 'Testosterone — Total', biomarkers: 'Testosterone (Total)', clientPrice: 6.9622, retailPrice: 15 },
  { name: 'Testosterone — Free + Total', biomarkers: 'Free Testosterone (equilibrium dialysis), Total Testosterone', clientPrice: 10.2422, retailPrice: 22 },
  { name: 'DHEA-S', biomarkers: 'Dehydroepiandrosterone Sulfate', clientPrice: 6.9622, retailPrice: 15 },
  { name: 'Estradiol (E2)', biomarkers: 'Estradiol (ultrasensitive LC/MS)', clientPrice: 8.6022, retailPrice: 18 },
  { name: 'Progesterone', biomarkers: 'Progesterone', clientPrice: 6.9622, retailPrice: 15 },
  { name: 'LH / FSH', biomarkers: 'Luteinizing Hormone, Follicle-Stimulating Hormone', clientPrice: 8.6022, retailPrice: 18 },
  { name: 'Cortisol (AM)', biomarkers: 'Cortisol — morning draw', clientPrice: 6.9622, retailPrice: 15 },
  { name: 'Insulin (Fasting)', biomarkers: 'Fasting Insulin', clientPrice: 6.9622, retailPrice: 15 },
  { name: 'SHBG', biomarkers: 'Sex Hormone Binding Globulin', clientPrice: 6.9622, retailPrice: 15 },
  { name: 'Complete Hormone Panel — Male', biomarkers: 'Total T, Free T, DHEA-S, SHBG, Estradiol, LH, FSH, Cortisol AM, PSA', clientPrice: 44.17, retailPrice: 98 },
  { name: 'Complete Hormone Panel — Female', biomarkers: 'Total T, Free T, DHEA-S, SHBG, Estradiol, Progesterone, LH, FSH, Cortisol AM', clientPrice: 44.17, retailPrice: 98 },

  { section: 'METABOLIC & DIABETES' },
  { name: 'HbA1c', biomarkers: 'Glycated Hemoglobin A1c', clientPrice: 5.3222, retailPrice: 12 },
  { name: 'Fasting Glucose', biomarkers: 'Blood Glucose (fasting)', clientPrice: 3.6822, retailPrice: 8 },
  { name: 'Fasting Insulin', biomarkers: 'Fasting Insulin Level', clientPrice: 6.9622, retailPrice: 15 },
  { name: 'HOMA-IR (calc.)', biomarkers: 'Insulin Resistance Index — Glucose × Insulin / 405', clientPrice: 8.6022, retailPrice: 18 },
  { name: 'Comprehensive Metabolic Risk', biomarkers: 'HbA1c, Fasting Glucose, Fasting Insulin, HOMA-IR, Triglycerides, HDL, ApoB', clientPrice: 29.44, retailPrice: 65 },

  { section: 'CARDIOVASCULAR & LIPID' },
  { name: 'Advanced Lipid Panel (NMR/VAP)', biomarkers: 'LDL-P, Small Dense LDL, HDL-P, VLDL, Remnant Cholesterol', clientPrice: 24.09, retailPrice: 55 },
  { name: 'ApoB', biomarkers: 'Apolipoprotein B', clientPrice: 8.6022, retailPrice: 18 },
  { name: 'Lp(a)', biomarkers: 'Lipoprotein(a)', clientPrice: 10.2422, retailPrice: 22 },
  { name: 'hsCRP', biomarkers: 'High-Sensitivity C-Reactive Protein', clientPrice: 6.9622, retailPrice: 15 },
  { name: 'Homocysteine', biomarkers: 'Homocysteine', clientPrice: 8.6022, retailPrice: 18 },
  { name: 'Omega-3 Index', biomarkers: 'EPA + DHA % of total RBC fatty acids', clientPrice: 15.57, retailPrice: 35 },
  { name: 'Cardiac Risk Panel', biomarkers: 'Standard Lipid, ApoB, Lp(a), hsCRP, Homocysteine, Fibrinogen', clientPrice: 39.35, retailPrice: 88 },

  { section: 'VITAMINS & NUTRIENTS' },
  { name: 'Vitamin D (25-OH)', biomarkers: '25-Hydroxyvitamin D (D2 + D3)', clientPrice: 6.9622, retailPrice: 15 },
  { name: 'Vitamin B12', biomarkers: 'Cobalamin', clientPrice: 5.3222, retailPrice: 12 },
  { name: 'Folate (RBC)', biomarkers: 'Red Blood Cell Folate', clientPrice: 6.9622, retailPrice: 15 },
  { name: 'Magnesium (RBC)', biomarkers: 'Intracellular Magnesium', clientPrice: 8.6022, retailPrice: 18 },
  { name: 'Zinc', biomarkers: 'Serum Zinc', clientPrice: 6.9622, retailPrice: 15 },
  { name: 'Micronutrient Panel', biomarkers: 'B12, Folate, Vitamin D, Magnesium RBC, Zinc, Selenium, Copper, B6', clientPrice: 44.17, retailPrice: 98 },

  { section: 'INFLAMMATION & IMMUNE' },
  { name: 'hsCRP', biomarkers: 'High-Sensitivity C-Reactive Protein', clientPrice: 6.9622, retailPrice: 15 },
  { name: 'ESR', biomarkers: 'Erythrocyte Sedimentation Rate', clientPrice: 3.6822, retailPrice: 8 },
  { name: 'IL-6', biomarkers: 'Interleukin-6', clientPrice: 10.2422, retailPrice: 22 },
  { name: 'TNF-alpha', biomarkers: 'Tumor Necrosis Factor Alpha', clientPrice: 12.88, retailPrice: 28 },
  { name: 'GlycoMark (1,5-AG)', biomarkers: '1,5-Anhydroglucitol — glycemic variability marker', clientPrice: 12.88, retailPrice: 28 },
  { name: 'Oxidative Stress Panel', biomarkers: 'Oxidized LDL, 8-OHdG, Glutathione, Superoxide Dismutase', clientPrice: 34.26, retailPrice: 76 },

  { section: 'TUMOR MARKERS' },
  { name: 'PSA (Total)', biomarkers: 'Prostate-Specific Antigen', clientPrice: 6.9622, retailPrice: 15 },
  { name: 'PSA (Free/Total Ratio)', biomarkers: 'Free PSA, Total PSA, Free/Total Ratio', clientPrice: 10.2422, retailPrice: 22 },
  { name: 'CA 125', biomarkers: 'Cancer Antigen 125 (ovarian)', clientPrice: 10.2422, retailPrice: 22 },
  { name: 'CA 19-9', biomarkers: 'Cancer Antigen 19-9 (pancreatic/GI)', clientPrice: 10.2422, retailPrice: 22 },
  { name: 'CEA', biomarkers: 'Carcinoembryonic Antigen', clientPrice: 8.6022, retailPrice: 18 },
  { name: 'AFP', biomarkers: 'Alpha-Fetoprotein', clientPrice: 8.6022, retailPrice: 18 },

  { section: 'URINALYSIS' },
  { name: 'Urinalysis (UA) — Dipstick', biomarkers: 'pH, SG, Protein, Glucose, Ketones, Nitrites, Leukocytes, Blood', clientPrice: 3.6822, retailPrice: 8 },
  { name: 'Urinalysis with Microscopy', biomarkers: 'Dipstick + RBCs, WBCs, Casts, Crystals, Bacteria', clientPrice: 5.3222, retailPrice: 12 },
  { name: 'Urine Microalbumin/Creatinine', biomarkers: 'Microalbumin, Creatinine, Ratio', clientPrice: 6.9622, retailPrice: 15 },
];

const PCR_PANELS = [
  { section: 'GASTRO PANEL (HS360-G1)' },
  { id: 'HS360-G1', category: 'Gastro', name: 'Adenovirus F40/41' },
  { id: 'HS360-G1', category: 'Gastro', name: 'Astrovirus' },
  { id: 'HS360-G1', category: 'Gastro', name: 'Campylobacter (jejuni/coli/upsaliensis)' },
  { id: 'HS360-G1', category: 'Gastro', name: 'Clostridioides difficile toxin A/B' },
  { id: 'HS360-G1', category: 'Gastro', name: 'Cryptosporidium' },
  { id: 'HS360-G1', category: 'Gastro', name: 'Cyclospora cayetanensis' },
  { id: 'HS360-G1', category: 'Gastro', name: 'Entamoeba histolytica' },
  { id: 'HS360-G1', category: 'Gastro', name: 'Enteropathogenic E. coli (EPEC)' },
  { id: 'HS360-G1', category: 'Gastro', name: 'Enterotoxigenic E. coli (ETEC) lt/st' },
  { id: 'HS360-G1', category: 'Gastro', name: 'STEC stx1/stx2' },
  { id: 'HS360-G1', category: 'Gastro', name: 'E. coli O157' },
  { id: 'HS360-G1', category: 'Gastro', name: 'Enteroaggregative E. coli (EAEC)' },
  { id: 'HS360-G1', category: 'Gastro', name: 'Enteroinvasive E. coli / Shigella' },
  { id: 'HS360-G1', category: 'Gastro', name: 'Giardia lamblia' },
  { id: 'HS360-G1', category: 'Gastro', name: 'Norovirus GI/GII' },
  { id: 'HS360-G1', category: 'Gastro', name: 'Plesiomonas shigelloides' },
  { id: 'HS360-G1', category: 'Gastro', name: 'Rotavirus A' },
  { id: 'HS360-G1', category: 'Gastro', name: 'Salmonella' },
  { id: 'HS360-G1', category: 'Gastro', name: 'Sapovirus (I, II, IV, V)' },
  { id: 'HS360-G1', category: 'Gastro', name: 'Vibrio cholerae / vulnificus / parahaemolyticus' },
  { id: 'HS360-G1', category: 'Gastro', name: 'Yersinia enterocolitica' },
  { section: 'HPV PANEL (HS360-HPV)' },
  { id: 'HS360-HPV', category: 'HPV', name: 'HPV Types 16, 18 (high risk — separate)' },
  { id: 'HS360-HPV', category: 'HPV', name: 'HPV Types 31, 33, 45, 52, 58 (other HR)' },
  { id: 'HS360-HPV', category: 'HPV', name: 'HPV Types 6, 11 (low risk)' },
];

const BLOOD_PANELS = [
  { section: 'CARDIAC RISK ASSESSMENT' },
  { section: 'Standard Lipid Panel', sub: true },
  { name: 'Total Cholesterol', status: 'Value', formula: 'Direct measurement' },
  { name: 'HDL Cholesterol', status: 'Value', formula: 'Direct measurement' },
  { name: 'LDL Cholesterol', status: 'Calculated', formula: 'Friedewald equation: TC − HDL − TG/5' },
  { name: 'Triglycerides', status: 'Value', formula: 'Direct measurement' },
  { name: 'Non-HDL Cholesterol', status: 'Calculated', formula: 'TC − HDL' },
  { section: 'Advanced Lipid Panel', sub: true },
  { name: 'ApoB', status: 'Value', formula: 'Immunoturbidimetric assay' },
  { name: 'ApoA-1', status: 'Value', formula: 'Immunoturbidimetric assay' },
  { name: 'ApoB / ApoA-1 Ratio', status: 'Calculated', formula: 'ApoB ÷ ApoA-1' },
  { name: 'Lp(a)', status: 'Value', formula: 'Immunoturbidimetric (nmol/L)' },
  { name: 'LDL-P (NMR)', status: 'Value', formula: 'NMR spectroscopy particle count' },
  { name: 'Small Dense LDL-P', status: 'Value', formula: 'NMR spectroscopy subfractionation' },
  { name: 'Remnant Cholesterol', status: 'Calculated', formula: 'TC − HDL − LDL' },
  { section: 'INFLAMMATION MARKERS' },
  { name: 'hsCRP', status: 'Value', formula: 'High-sensitivity immunoturbidimetric' },
  { name: 'Homocysteine', status: 'Value', formula: 'Enzymatic cycling assay' },
  { name: 'Fibrinogen', status: 'Value', formula: 'Clauss clotting method' },
  { name: 'Oxidized LDL', status: 'Value', formula: 'ELISA — malondialdehyde-modified LDL' },
  { section: 'METABOLIC RISK' },
  { name: 'Fasting Glucose', status: 'Value', formula: 'Hexokinase enzymatic' },
  { name: 'Fasting Insulin', status: 'Value', formula: 'Electrochemiluminescence immunoassay' },
  { name: 'HOMA-IR', status: 'Calculated', formula: 'Fasting Glucose (mmol/L) × Fasting Insulin (µU/mL) ÷ 22.5' },
  { name: 'HbA1c', status: 'Value', formula: 'HPLC (NGSP certified)' },
];

const GENETIC_TESTING = [
  { section: 'PHARMACOGENOMICS (PGX)' },
  { name: 'CYP2D6', included: true, status: 'Genotype + Phenotype', notes: 'Opioids, antidepressants, antipsychotics, beta-blockers' },
  { name: 'CYP2C19', included: true, status: 'Genotype + Phenotype', notes: 'PPIs, SSRIs, clopidogrel, antifungals' },
  { name: 'CYP2C9', included: true, status: 'Genotype + Phenotype', notes: 'Warfarin, NSAIDs, oral hypoglycemics' },
  { name: 'CYP3A4 / CYP3A5', included: true, status: 'Genotype + Phenotype', notes: 'Statins, immunosuppressants, benzodiazepines' },
  { name: 'CYP1A2', included: true, status: 'Genotype + Phenotype', notes: 'Caffeine, clozapine, tacrine' },
  { name: 'SLCO1B1', included: true, status: 'Genotype', notes: 'Statin-induced myopathy risk' },
  { name: 'VKORC1', included: true, status: 'Genotype', notes: 'Warfarin dosing sensitivity' },
  { name: 'DPYD', included: true, status: 'Genotype', notes: '5-Fluorouracil / capecitabine toxicity' },
  { name: 'TPMT / NUDT15', included: true, status: 'Genotype', notes: 'Thiopurine (azathioprine/6-MP) dosing' },
  { name: 'UGT1A1', included: true, status: 'Genotype', notes: 'Irinotecan toxicity' },
  { name: 'HLA-B*57:01', included: true, status: 'Genotype', notes: 'Abacavir hypersensitivity' },
  { name: 'HLA-B*15:02', included: true, status: 'Genotype', notes: 'Carbamazepine-induced SJS/TEN' },
  { section: 'HEREDITARY CANCER SCREENING' },
  { name: 'BRCA1', included: true, status: 'Sequence + Del/Dup', notes: 'Hereditary breast/ovarian cancer (HBOC)' },
  { name: 'BRCA2', included: true, status: 'Sequence + Del/Dup', notes: 'Hereditary breast/ovarian/pancreatic cancer' },
  { name: 'MLH1', included: true, status: 'Sequence + Del/Dup', notes: 'Lynch syndrome (colorectal/endometrial)' },
  { name: 'MSH2', included: true, status: 'Sequence + Del/Dup', notes: 'Lynch syndrome' },
  { name: 'MSH6', included: true, status: 'Sequence + Del/Dup', notes: 'Lynch syndrome' },
  { name: 'PMS2', included: true, status: 'Sequence + Del/Dup', notes: 'Lynch syndrome' },
  { name: 'EPCAM', included: true, status: 'Del/Dup only', notes: 'Lynch syndrome (MSH2 silencing)' },
  { name: 'PALB2', included: true, status: 'Sequence + Del/Dup', notes: 'Breast/pancreatic cancer risk' },
  { name: 'CHEK2', included: true, status: 'Sequence + Del/Dup', notes: 'Moderate breast cancer risk' },
  { name: 'ATM', included: true, status: 'Sequence + Del/Dup', notes: 'Breast/pancreatic cancer, ataxia-telangiectasia' },
  { name: 'CDH1', included: true, status: 'Sequence + Del/Dup', notes: 'Hereditary diffuse gastric cancer, lobular breast cancer' },
  { name: 'STK11', included: true, status: 'Sequence + Del/Dup', notes: 'Peutz-Jeghers syndrome, GI/breast cancer' },
  { name: 'TP53', included: true, status: 'Sequence + Del/Dup', notes: 'Li-Fraumeni syndrome' },
  { name: 'VHL', included: true, status: 'Sequence + Del/Dup', notes: 'Von Hippel-Lindau, clear cell RCC, hemangioblastomas' },
  { name: 'RET', included: true, status: 'Sequence', notes: 'MEN2, medullary thyroid carcinoma' },
  { name: 'APC', included: true, status: 'Sequence + Del/Dup', notes: 'Familial adenomatous polyposis (FAP)' },
];

const ALLERGY_TESTING = [
  { section: 'ALEX3 ALLERGY PANEL (300 Allergens)' },
  { name: 'Total IgE', category: 'Serology', notes: 'Baseline atopic burden assessment' },
  { section: 'Tree Pollens', sub: true },
  { name: 'Oak (Quercus robur)', category: 'Pollen', notes: 'Spring season, widespread in N. America/Europe' },
  { name: 'Birch (Betula verrucosa)', category: 'Pollen', notes: 'Key sensitizer — Bet v 1 cross-reactivity' },
  { name: 'Alder (Alnus glutinosa)', category: 'Pollen', notes: 'Early spring, Fagales cross-reaction' },
  { name: 'Hazel (Corylus avellana)', category: 'Pollen', notes: 'Bet v 1 homolog' },
  { name: 'Ash (Fraxinus excelsior)', category: 'Pollen', notes: 'Ole e 1 group' },
  { name: 'Olive (Olea europaea)', category: 'Pollen', notes: 'Mediterranean, Ole e 1 major allergen' },
  { name: 'Mountain Cedar (Juniperus ashei)', category: 'Pollen', notes: 'TX/Southwest US winter season' },
  { name: 'Cypress (Cupressus sempervirens)', category: 'Pollen', notes: 'Cup a 1 cross-reactivity with cedar' },
  { section: 'Grass Pollens', sub: true },
  { name: 'Timothy Grass (Phleum pratense)', category: 'Pollen', notes: 'Reference grass allergen — Phl p 1, 5' },
  { name: 'Rye Grass (Lolium perenne)', category: 'Pollen', notes: 'Widespread, Lol p 1' },
  { name: 'Bermuda Grass (Cynodon dactylon)', category: 'Pollen', notes: 'Year-round in warm climates' },
  { name: 'Johnson Grass (Sorghum halepense)', category: 'Pollen', notes: 'SE/SW US' },
  { section: 'Weed Pollens', sub: true },
  { name: 'Short Ragweed (Ambrosia artemisiifolia)', category: 'Pollen', notes: 'Major North American allergen — Amb a 1' },
  { name: 'Mugwort (Artemisia vulgaris)', category: 'Pollen', notes: 'Art v 1 — cross-reacts with celery, carrot' },
  { name: 'English Plantain (Plantago lanceolata)', category: 'Pollen', notes: 'Widespread weed' },
  { section: 'House Dust Mites', sub: true },
  { name: 'Dermatophagoides pteronyssinus', category: 'Dust Mite', notes: 'Der p 1, Der p 2 — perennial allergen' },
  { name: 'Dermatophagoides farinae', category: 'Dust Mite', notes: 'Der f 1, Der f 2' },
  { name: 'Blomia tropicalis', category: 'Dust Mite', notes: 'Tropical storage mite' },
  { section: 'Insects & Stinging Insects', sub: true },
  { name: 'Honeybee (Apis mellifera)', category: 'Insect', notes: 'Api m 1 (phospholipase A2)' },
  { name: 'Common Wasp (Vespula vulgaris)', category: 'Insect', notes: 'Ves v 5 (antigen 5)' },
  { name: 'German Wasp (Vespula germanica)', category: 'Insect', notes: 'Ves g 5' },
  { name: 'Paper Wasp (Polistes dominula)', category: 'Insect', notes: 'Pol d 5' },
  { section: 'Animal Dander & Epithelia', sub: true },
  { name: 'Cat (Felis domesticus)', category: 'Animal', notes: 'Fel d 1 — major allergen, very stable' },
  { name: 'Dog (Canis familiaris)', category: 'Animal', notes: 'Can f 1, Can f 5 (lipocalins)' },
  { name: 'Horse (Equus caballus)', category: 'Animal', notes: 'Equ c 1 (lipocalin)' },
  { name: 'Cow Dander', category: 'Animal', notes: 'Bos d 2 (lipocalin)' },
  { section: 'Molds & Fungi', sub: true },
  { name: 'Aspergillus fumigatus', category: 'Mold', notes: 'Asp f 1, Asp f 3 — relevant in ABPA' },
  { name: 'Alternaria alternata', category: 'Mold', notes: 'Alt a 1 — outdoor mold' },
  { name: 'Cladosporium herbarum', category: 'Mold', notes: 'Cla h 8' },
  { name: 'Penicillium chrysogenum', category: 'Mold', notes: 'Pen ch 13, 18, 20' },
  { section: 'Food Allergens (Selected)', sub: true },
  { name: 'Peanut (Arachis hypogaea)', category: 'Food', notes: 'Ara h 1, 2, 3, 8, 9 — component testing available' },
  { name: "Cow's Milk", category: 'Food', notes: 'Bos d 4, 5, 8 (alpha-lac, beta-lac, casein)' },
  { name: 'Hen Egg White', category: 'Food', notes: 'Gal d 1 (ovomucoid) — heat-stable' },
  { name: 'Wheat', category: 'Food', notes: 'Tri a 19 (omega-5 gliadin) — EIA risk' },
  { name: 'Soy (Glycine max)', category: 'Food', notes: 'Gly m 4, Gly m 5, Gly m 6' },
  { name: 'Hazelnut', category: 'Food', notes: 'Cor a 1, 8, 9, 14' },
  { name: 'Shrimp (Penaeus aztecus)', category: 'Food', notes: 'Pen a 1 (tropomyosin) — shellfish cross-react' },
  { name: 'Codfish', category: 'Food', notes: 'Gad c 1 (parvalbumin) — fish cross-react' },
];

// ─── Tab Definitions ─────────────────────────────────────────────────────────

const TABS = [
  { id: 'main', label: 'HS360 Price List', icon: Tag, description: 'Client & retail pricing for all test panels' },
  { id: 'pcr', label: 'PCR Panels', icon: FlaskConical, description: 'Gastrointestinal pathogen & HPV molecular panels' },
  { id: 'blood', label: 'Blood Panels', icon: Activity, description: 'Cardiac risk, lipid, metabolic & inflammation markers' },
  { id: 'genetic', label: 'Genetic Testing', icon: Dna, description: 'Pharmacogenomics & hereditary cancer screening' },
  { id: 'allergy', label: 'Allergy Testing', icon: Wind, description: 'ALEX3 300-allergen comprehensive IgE panel' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtPrice(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);
}

function SectionHeader({ label, sub }) {
  if (sub) {
    return (
      <tr>
        <td colSpan={10} className="pt-4 pb-1 px-3">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">{label}</span>
        </td>
      </tr>
    );
  }
  return (
    <tr>
      <td colSpan={10} className="pt-6 pb-2 px-3">
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-700/60" />
          <span className="text-xs font-bold text-teal-400 uppercase tracking-widest whitespace-nowrap">{label}</span>
          <div className="h-px flex-1 bg-slate-700/60" />
        </div>
      </td>
    </tr>
  );
}

// ─── Tab Views ────────────────────────────────────────────────────────────────

function MainPriceList({ search }) {
  const filtered = HS360_PRICE_LIST.filter((item) => {
    if (item.section) return true;
    const q = search.toLowerCase();
    return (
      item.name.toLowerCase().includes(q) ||
      item.biomarkers.toLowerCase().includes(q)
    );
  });

  // Remove leading sections with no visible rows after filtering
  const visible = [];
  for (let i = 0; i < filtered.length; i++) {
    const curr = filtered[i];
    if (curr.section) {
      const next = filtered[i + 1];
      if (next && !next.section) visible.push(curr);
    } else {
      visible.push(curr);
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-slate-400 text-xs border-b border-slate-700/60 sticky top-0 bg-slate-900/95 backdrop-blur-sm z-10">
            <th className="text-left font-semibold py-3 px-3 min-w-[200px]">Test / Panel Name</th>
            <th className="text-left font-semibold py-3 px-3 min-w-[280px]">Biomarkers Included</th>
            <th className="text-right font-semibold py-3 px-3 whitespace-nowrap">Client Price</th>
            <th className="text-right font-semibold py-3 px-3 whitespace-nowrap">Retail Price</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((item, idx) =>
            item.section ? (
              <SectionHeader key={`sec-${idx}`} label={item.section} />
            ) : (
              <tr key={idx} className="border-b border-slate-700/20 hover:bg-slate-800/40 transition-colors group">
                <td className="py-2.5 px-3 text-slate-200 font-medium">{item.name}</td>
                <td className="py-2.5 px-3 text-slate-400 text-xs leading-relaxed">{item.biomarkers}</td>
                <td className="py-2.5 px-3 text-right text-teal-400 font-mono font-semibold whitespace-nowrap">
                  {fmtPrice(item.clientPrice)}
                </td>
                <td className="py-2.5 px-3 text-right text-slate-300 font-mono whitespace-nowrap">
                  {fmtPrice(item.retailPrice)}
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
      {visible.filter((i) => !i.section).length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-slate-400 text-sm">No results for &ldquo;{search}&rdquo;</p>
        </div>
      )}
    </div>
  );
}

function PcrPanelList({ search }) {
  const filtered = PCR_PANELS.filter((item) => {
    if (item.section) return true;
    const q = search.toLowerCase();
    return item.name.toLowerCase().includes(q) || item.category?.toLowerCase().includes(q);
  });

  const visible = [];
  for (let i = 0; i < filtered.length; i++) {
    const curr = filtered[i];
    if (curr.section) {
      const next = filtered[i + 1];
      if (next && !next.section) visible.push(curr);
    } else {
      visible.push(curr);
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-slate-400 text-xs border-b border-slate-700/60 sticky top-0 bg-slate-900/95 backdrop-blur-sm z-10">
            <th className="text-left font-semibold py-3 px-3">Panel ID</th>
            <th className="text-left font-semibold py-3 px-3">Category</th>
            <th className="text-left font-semibold py-3 px-3">Target Pathogen / Analyte</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((item, idx) =>
            item.section ? (
              <SectionHeader key={`sec-${idx}`} label={item.section} />
            ) : (
              <tr key={idx} className="border-b border-slate-700/20 hover:bg-slate-800/40 transition-colors">
                <td className="py-2.5 px-3">
                  <span className="px-2 py-0.5 bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-mono rounded">
                    {item.id}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-slate-400 text-xs">{item.category}</td>
                <td className="py-2.5 px-3 text-slate-200">{item.name}</td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}

function BloodPanelList({ search }) {
  const filtered = BLOOD_PANELS.filter((item) => {
    if (item.section) return true;
    const q = search.toLowerCase();
    return item.name?.toLowerCase().includes(q) || item.formula?.toLowerCase().includes(q);
  });

  const visible = [];
  for (let i = 0; i < filtered.length; i++) {
    const curr = filtered[i];
    if (curr.section) {
      const next = filtered[i + 1];
      if (next && !next.section) visible.push(curr);
    } else {
      visible.push(curr);
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-slate-400 text-xs border-b border-slate-700/60 sticky top-0 bg-slate-900/95 backdrop-blur-sm z-10">
            <th className="text-left font-semibold py-3 px-3 min-w-[180px]">Panel / Analyte</th>
            <th className="text-left font-semibold py-3 px-3">Status</th>
            <th className="text-left font-semibold py-3 px-3">Formula / Clinical Use</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((item, idx) =>
            item.section ? (
              <SectionHeader key={`sec-${idx}`} label={item.section} sub={item.sub} />
            ) : (
              <tr key={idx} className="border-b border-slate-700/20 hover:bg-slate-800/40 transition-colors">
                <td className="py-2.5 px-3 text-slate-200 font-medium">{item.name}</td>
                <td className="py-2.5 px-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                    item.status === 'Calculated'
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  }`}>
                    {item.status === 'Calculated' ? 'Calculated' : 'Measured'}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-slate-400 text-xs">{item.formula}</td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}

function GeneticPanelList({ search }) {
  const filtered = GENETIC_TESTING.filter((item) => {
    if (item.section) return true;
    const q = search.toLowerCase();
    return item.name?.toLowerCase().includes(q) || item.notes?.toLowerCase().includes(q);
  });

  const visible = [];
  for (let i = 0; i < filtered.length; i++) {
    const curr = filtered[i];
    if (curr.section) {
      const next = filtered[i + 1];
      if (next && !next.section) visible.push(curr);
    } else {
      visible.push(curr);
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-slate-400 text-xs border-b border-slate-700/60 sticky top-0 bg-slate-900/95 backdrop-blur-sm z-10">
            <th className="text-left font-semibold py-3 px-3 min-w-[120px]">Gene</th>
            <th className="text-left font-semibold py-3 px-3">Test Type</th>
            <th className="text-left font-semibold py-3 px-3">Clinical Relevance</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((item, idx) =>
            item.section ? (
              <SectionHeader key={`sec-${idx}`} label={item.section} />
            ) : (
              <tr key={idx} className="border-b border-slate-700/20 hover:bg-slate-800/40 transition-colors">
                <td className="py-2.5 px-3">
                  <span className="text-white font-mono font-semibold">{item.name}</span>
                  {item.included && (
                    <span className="ml-2 px-1.5 py-0.5 bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs rounded">
                      Included
                    </span>
                  )}
                </td>
                <td className="py-2.5 px-3 text-slate-300 text-xs">{item.status}</td>
                <td className="py-2.5 px-3 text-slate-400 text-xs">{item.notes}</td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}

function AllergyPanelList({ search }) {
  const filtered = ALLERGY_TESTING.filter((item) => {
    if (item.section) return true;
    const q = search.toLowerCase();
    return item.name?.toLowerCase().includes(q) || item.category?.toLowerCase().includes(q) || item.notes?.toLowerCase().includes(q);
  });

  const visible = [];
  for (let i = 0; i < filtered.length; i++) {
    const curr = filtered[i];
    if (curr.section) {
      const next = filtered[i + 1];
      if (next && !next.section) visible.push(curr);
    } else {
      visible.push(curr);
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-slate-400 text-xs border-b border-slate-700/60 sticky top-0 bg-slate-900/95 backdrop-blur-sm z-10">
            <th className="text-left font-semibold py-3 px-3 min-w-[200px]">Allergen / Panel</th>
            <th className="text-left font-semibold py-3 px-3">Category</th>
            <th className="text-left font-semibold py-3 px-3">Details</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((item, idx) =>
            item.section ? (
              <SectionHeader key={`sec-${idx}`} label={item.section} sub={item.sub} />
            ) : (
              <tr key={idx} className="border-b border-slate-700/20 hover:bg-slate-800/40 transition-colors">
                <td className="py-2.5 px-3 text-slate-200 font-medium">{item.name}</td>
                <td className="py-2.5 px-3">
                  {item.category && (
                    <span className="px-2 py-0.5 bg-slate-700/60 text-slate-300 text-xs rounded border border-slate-600/40">
                      {item.category}
                    </span>
                  )}
                </td>
                <td className="py-2.5 px-3 text-slate-400 text-xs">{item.notes}</td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export default function PriceListView() {
  const [activeTab, setActiveTab] = useState('main');
  const [search, setSearch] = useState('');

  const tab = TABS.find((t) => t.id === activeTab);

  function renderContent() {
    switch (activeTab) {
      case 'main': return <MainPriceList search={search} />;
      case 'pcr': return <PcrPanelList search={search} />;
      case 'blood': return <BloodPanelList search={search} />;
      case 'genetic': return <GeneticPanelList search={search} />;
      case 'allergy': return <AllergyPanelList search={search} />;
      default: return null;
    }
  }

  return (
    <div className="space-y-5">
      {/* Info bar */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-800/40 border border-slate-700/50 rounded-xl text-xs text-slate-400">
        <span className="font-medium text-slate-300">HealthSpan360 Pricing</span>
        <span className="hidden sm:inline text-slate-600">|</span>
        <span>Effective March 2026</span>
        <span className="hidden sm:inline text-slate-600">|</span>
        <span>CLIA: 45D2326543</span>
        <span className="hidden sm:inline text-slate-600">|</span>
        <span>Lab Director: Phuoc Hung Nguyen</span>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-x-auto">
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = t.id === activeTab;
          return (
            <button
              key={t.id}
              onClick={() => { setActiveTab(t.id); setSearch(''); }}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                isActive
                  ? 'bg-teal-500/20 border border-teal-500/30 text-teal-400'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/40'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.label}</span>
              <span className="sm:hidden">{t.label.split(' ')[0]}</span>
            </button>
          );
        })}
      </div>

      {/* Panel Card */}
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl overflow-hidden">
        {/* Panel Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 border-b border-slate-700/50">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {tab && <tab.icon className="w-4 h-4 text-teal-400 flex-shrink-0" />}
            <div className="min-w-0">
              <h3 className="text-white font-semibold text-sm">{tab?.label}</h3>
              <p className="text-slate-400 text-xs truncate">{tab?.description}</p>
            </div>
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-2 bg-slate-900/60 border border-slate-700/60 rounded-lg text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:border-teal-500/50 w-full sm:w-56 transition-colors"
            />
          </div>
        </div>

        {/* Table content */}
        <div className="max-h-[600px] overflow-y-auto">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
