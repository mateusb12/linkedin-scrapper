const TECH_DICTIONARY = [
  "JavaScript",
  "TypeScript",
  "Python",
  "Java",
  "C#",
  "C++",
  "Go",
  "Rust",

  "React",
  "React Native",
  "Vue",
  "Angular",
  "Next.js",
  "Tailwind",
  "Styled Components",

  "Node.js",
  "Express",
  "FastAPI",
  "Django",
  "Flask",
  "Spring Boot",

  "AWS",
  "GCP",
  "Azure",
  "Docker",
  "Kubernetes",
  "CI/CD",

  "PostgreSQL",
  "MySQL",
  "MongoDB",
  "Redis",

  "RabbitMQ",
  "Kafka",

  "Linux",
  "Raspberry Pi",
  "PM2",
  "Nginx",
  "Git",
  "GitHub",

  "Blender",
  "Unity",
  "Unreal",
  "Figma",
];

export function extractTechStack(description) {
  if (!description) return [];

  const found = new Set();

  for (const tech of TECH_DICTIONARY) {
    const regex = new RegExp(
      `\\b${tech.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
      "i",
    );
    if (regex.test(description)) {
      found.add(tech);
    }
  }

  return Array.from(found);
}
