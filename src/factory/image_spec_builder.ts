import type { AssetSpec, AssetDraft } from "./types.js";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

interface ImagePromptSpec {
  product_name: string;
  product_type: string;
  description: string;
  brand_style: string;
  visual_style: string;
  camera: string;
  lighting: string;
  location: string;
  atmosphere: string;
  elements: string[];
  motion: string;
  cta_motion: string;
  ending: string;
  text: Record<string, string>;
  keywords: string[];
}

function inferProductType(topic: string): string {
  const t = topic.toLowerCase();
  if (t.includes("watch") || t.includes("wearable")) return "smartwatch";
  if (t.includes("drink") || t.includes("beverage") || t.includes("coffee")) return "beverage";
  if (t.includes("app") || t.includes("software") || t.includes("saas")) return "software-product";
  if (t.includes("headphone") || t.includes("earphone") || t.includes("airpod")) return "audio-device";
  if (t.includes("phone") || t.includes("mobile")) return "mobile-device";
  if (t.includes("car") || t.includes("vehicle") || t.includes("auto")) return "automotive";
  if (t.includes("clothing") || t.includes("fashion") || t.includes("apparel")) return "fashion";
  if (t.includes("food") || t.includes("snack") || t.includes("nutrition")) return "food-product";
  if (t.includes("service") || t.includes("consulting") || t.includes("agency")) return "service";
  return "consumer-product";
}

function inferCameraSettings(style: string): string {
  const s = style.toLowerCase();
  if (s.includes("luxury") || s.includes("premium")) {
    return "Close-up macro shot, depth of field, bokeh background";
  }
  if (s.includes("action") || s.includes("energy") || s.includes("dynamic")) {
    return "Dynamic tracking shot, low angle, fast motion blur";
  }
  if (s.includes("minimal") || s.includes("clean") || s.includes("simple")) {
    return "Centered overhead shot, white or gradient background, symmetrical framing";
  }
  if (s.includes("futurist") || s.includes("tech") || s.includes("cyber")) {
    return "360 rotating product shot, floating in dark space, light trails";
  }
  return "Three-quarter product angle, clean studio background, professional lighting";
}

function inferLighting(style: string): string {
  const s = style.toLowerCase();
  if (s.includes("luxury")) return "Cinematic golden hour lighting, warm rim light, subtle shadows";
  if (s.includes("tech") || s.includes("futurist")) return "Neon blue and purple lighting, holographic highlights";
  if (s.includes("minimal") || s.includes("clean")) return "Soft box lighting, even diffused light, pure white highlights";
  if (s.includes("nature") || s.includes("organic")) return "Natural sunlight, soft shadows, earthy tones";
  return "Professional studio three-point lighting, crisp highlights";
}

function inferAtmosphere(topic: string, style: string): string {
  const combined = `${topic} ${style}`.toLowerCase();
  if (combined.includes("luxury") || combined.includes("premium")) return "High-end, aspirational, exclusive";
  if (combined.includes("energy") || combined.includes("sport")) return "Electric, high-energy, motivating";
  if (combined.includes("wellness") || combined.includes("health")) return "Calm, rejuvenating, trustworthy";
  if (combined.includes("tech") || combined.includes("innovation")) return "Cutting-edge, forward-thinking, intelligent";
  if (combined.includes("fun") || combined.includes("playful")) return "Vibrant, joyful, approachable";
  return "Professional, confident, modern";
}

/**
 * Builds a structured image/video generation prompt spec from an AssetSpec.
 * Output matches the existing image_prompts/veo/ JSON schema.
 */
export function buildImageSpec(spec: AssetSpec): AssetDraft {
  const productName = spec.topic;
  const brandStyle = spec.style ?? "modern and professional";
  const visualStyle = spec.audience ?? "clean and polished";
  const productType = inferProductType(spec.topic);

  const imageSpec: ImagePromptSpec = {
    product_name: productName,
    product_type: productType,
    description: `${spec.goal}. A visually stunning ${brandStyle.toLowerCase()} presentation of ${productName} that captures attention and drives ${spec.goal.toLowerCase()}.`,
    brand_style: brandStyle,
    visual_style: visualStyle,
    camera: inferCameraSettings(brandStyle),
    lighting: inferLighting(brandStyle),
    location: inferLocation(spec),
    atmosphere: inferAtmosphere(spec.topic, brandStyle),
    elements: buildElements(spec),
    motion: buildMotion(brandStyle),
    cta_motion: `Smooth zoom-in on ${productName} with brand tagline reveal`,
    ending: `Fade to brand logo with website URL — ${productName} hero shot remains`,
    text: {
      headline: `{{Product Tagline}}`,
      subtext: `{{Key Benefit}}`,
      cta: `{{Call to Action}}`,
    },
    keywords: buildKeywords(spec, productType, brandStyle),
  };

  const content = JSON.stringify(imageSpec, null, 2);
  const slug = slugify(productName);

  return {
    spec,
    content,
    suggestedFilename: `${slug}_image_prompt.json`,
    suggestedCategory: "image-prompt",
    variables: ["Product Tagline", "Key Benefit", "Call to Action"],
    estimatedQuality: "high",
  };
}

function inferLocation(spec: AssetSpec): string {
  const combined = `${spec.topic} ${spec.style ?? ""} ${spec.context ?? ""}`.toLowerCase();
  if (combined.includes("outdoor") || combined.includes("nature") || combined.includes("adventure")) return "Scenic outdoor environment with natural elements";
  if (combined.includes("urban") || combined.includes("city") || combined.includes("street")) return "Modern urban setting, architectural backgrounds";
  if (combined.includes("luxury") || combined.includes("penthouse") || combined.includes("yacht")) return "High-end luxury environment, elegant interior";
  if (combined.includes("studio") || combined.includes("minimal") || combined.includes("clean")) return "Minimalist studio with seamless gradient backdrop";
  if (combined.includes("tech") || combined.includes("digital") || combined.includes("cyber")) return "Abstract digital environment, dark background with light effects";
  return "Clean studio environment with subtle brand-colored background";
}

function buildElements(spec: AssetSpec): string[] {
  const elements = [`${spec.topic} as the hero product`];
  const combined = `${spec.topic} ${spec.style ?? ""}`.toLowerCase();

  if (combined.includes("luxury")) elements.push("Premium material textures", "Gold or silver accents", "Subtle reflections");
  if (combined.includes("tech")) elements.push("Holographic data overlays", "Clean UI elements", "Particle effects");
  if (combined.includes("nature") || combined.includes("organic")) elements.push("Natural material elements", "Botanical accents", "Earthy textures");
  if (combined.includes("energy") || combined.includes("sport")) elements.push("Motion blur effects", "Dynamic light trails", "Kinetic energy visualization");

  elements.push("Brand color palette integration", "High-quality product details in focus");

  return elements.slice(0, 6);
}

function buildMotion(style: string): string {
  const s = style.toLowerCase();
  if (s.includes("luxury")) return "Slow-motion reveal with graceful rotation, product floating effect";
  if (s.includes("energy") || s.includes("sport")) return "Fast-paced dynamic movement, quick cuts between angles";
  if (s.includes("minimal") || s.includes("clean")) return "Smooth, deliberate single rotation with subtle parallax";
  if (s.includes("tech") || s.includes("futurist")) return "360 holographic spin, data visualization animations";
  return "Elegant product rotation with smooth camera dolly, 3-5 seconds";
}

function buildKeywords(spec: AssetSpec, productType: string, style: string): string[] {
  const base = [
    slugify(spec.topic),
    productType,
    "product photography",
    "commercial video",
    "brand visual",
  ];

  const styleKeywords = style.toLowerCase().split(/[\s,]+/).filter((w) => w.length > 3).slice(0, 3);
  const topicKeywords = spec.topic.toLowerCase().split(/[\s-]+/).filter((w) => w.length > 3).slice(0, 2);
  const goalKeywords = spec.goal.toLowerCase().split(/[\s-]+/).filter((w) => w.length > 3).slice(0, 2);

  return [...new Set([...base, ...styleKeywords, ...topicKeywords, ...goalKeywords])].slice(0, 10);
}
