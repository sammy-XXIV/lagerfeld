import type { Occasion } from "./rubric.js";

/**
 * Reference standards the agent grounds its verdict in, instead of relying
 * on the model's undocumented internal sense of "looks right." Sourced from
 * established, publicly documented dress-code/tailoring conventions (formal
 * dress-code protocol standards, classic menswear/womenswear tailoring
 * principles, standard color-theory pairing rules) rather than any single
 * named designer's proprietary work.
 */
export interface OccasionStandard {
  formalityTier: string;
  requiredElements: string[];
  hardNos: string[];
  colorGuidance: string;
  tailoringNotes: string;
}

export const OCCASION_STANDARDS: Record<Occasion, OccasionStandard> = {
  job_interview: {
    formalityTier: "Business to business-casual, calibrated to industry norms visible in the outfit.",
    requiredElements: [
      "Clean, unwrinkled garments",
      "Closed-toe shoes",
      "Neutral-to-conservative color palette",
    ],
    hardNos: ["Visible logos/graphics", "Gym or athleisure wear", "Flip-flops or slides"],
    colorGuidance:
      "Classic tailoring convention: neutrals (navy, charcoal, black, white, beige) as the base, with at most one accent color. High-contrast or clashing complementary-color pairings read as unpolished in a professional context.",
    tailoringNotes:
      "Fit should follow standard tailoring convention: shoulders sit at the natural shoulder line, sleeves end at the wrist bone, trousers break cleanly at the shoe — visible bunching or oversized fit reads as ill-fitted regardless of style.",
  },
  wedding_guest: {
    formalityTier: "Cocktail to semi-formal, calibrated to venue cues in the photo (daytime/casual venue vs. evening/formal venue).",
    requiredElements: ["Pressed, intentional garments", "Coordinated accessories"],
    hardNos: [
      "White, ivory, or cream (reserved for the bride under Western wedding convention)",
      "All-black formal wear that could read as funeral attire in a daytime/garden setting",
      "Overly casual denim or graphic tees",
    ],
    colorGuidance:
      "Jewel tones, pastels, and classic neutrals are all standard-safe. Avoid pure white/ivory entirely per convention above.",
    tailoringNotes: "Should read as 'dressed up' relative to daily wear — structured, not loungewear-adjacent.",
  },
  first_date: {
    formalityTier: "Smart casual — put-together without reading as overdressed for a casual setting.",
    requiredElements: ["At least one intentional/structured piece (not all loungewear)"],
    hardNos: ["Full gym wear", "Visibly unwashed or heavily wrinkled clothing"],
    colorGuidance:
      "Standard color-pairing convention: complementary or analogous color pairs (adjacent or opposite on the color wheel) read as intentional; three or more unrelated bright colors together read as uncoordinated.",
    tailoringNotes: "Fit matters more than formality here — well-fitted casual beats ill-fitted dressy.",
  },
  business_meeting: {
    formalityTier: "Professional, conservative — matches job_interview standard.",
    requiredElements: ["Structured garments", "Neutral palette"],
    hardNos: ["Streetwear", "Loungewear", "Overly casual footwear"],
    colorGuidance: "Same neutral-base convention as job_interview.",
    tailoringNotes: "Same tailoring convention as job_interview.",
  },
  funeral: {
    formalityTier: "Formal, muted, conservative.",
    requiredElements: ["Dark or muted-toned garments", "Conservative coverage"],
    hardNos: ["Bright or saturated colors", "Busy/loud patterns", "Casual footwear (sneakers, sandals)"],
    colorGuidance:
      "Standard mourning-dress convention: black, charcoal, navy, and other dark neutrals. Even well-coordinated bright colors are inappropriate regardless of color-theory pairing quality.",
    tailoringNotes: "Understated is correct here — nothing should draw visual attention.",
  },
  casual_hangout: {
    formalityTier: "Low bar — comfort-first.",
    requiredElements: [],
    hardNos: ["Nothing hard-blocked — flag only glaring, likely-unintentional mismatches"],
    colorGuidance: "Any pairing is acceptable unless it reads as clearly unintentional.",
    tailoringNotes: "Not evaluated strictly — comfort and personal style take priority.",
  },
  night_out_party: {
    formalityTier: "Expressive, statement-driven — bar for 'appropriate' is intentionality, not formality.",
    requiredElements: ["At least one deliberate styling choice"],
    hardNos: ["Outfit reads as sloppy rather than as a deliberate style choice"],
    colorGuidance: "Bold and unconventional pairings are encouraged here, unlike other occasions.",
    tailoringNotes: "Evaluate for 'intentional' vs 'thrown together,' not for conservative fit.",
  },
  formal_black_tie: {
    formalityTier: "Full formal wear — tuxedo/formal suit or gown, per standard black-tie protocol.",
    requiredElements: ["Tuxedo or formal dark suit (menswear) / floor-length or formal cocktail dress (womenswear)", "Formal shoes"],
    hardNos: ["Any casual element", "Standard business suit substituted for a tuxedo", "Sneakers of any kind"],
    colorGuidance: "Black-tie convention: black, midnight blue as the traditional base; minimal deviation.",
    tailoringNotes: "Precision tailoring expected — this is the strictest formality tier, deviations are heavily penalized.",
  },
};

export function standardsBlock(occasion: Occasion): string {
  const s = OCCASION_STANDARDS[occasion];
  return `REFERENCE STANDARD for ${occasion.replace(/_/g, " ")}:
- Formality tier: ${s.formalityTier}
- Required elements: ${s.requiredElements.length ? s.requiredElements.join("; ") : "none strict"}
- Hard no's: ${s.hardNos.join("; ")}
- Color guidance: ${s.colorGuidance}
- Tailoring/fit notes: ${s.tailoringNotes}

Base your dress_code_match, occasion_flags, and verdict on this reference standard, not on general impression. If something in the photo conflicts with a "hard no" above, it must appear in occasion_flags.`;
}
