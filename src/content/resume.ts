/**
 * All resume content lives here. The page renders whatever this file says,
 * so updating the resume never means editing markup.
 *
 * Every value below is placeholder text — replace it with the real thing.
 * Any section left as an empty array is skipped by the page automatically.
 */

export type ResumeLink = {
  label: string;
  href: string;
};

export type ExperienceItem = {
  role: string;
  org: string;
  /** Optional link to the organisation. */
  href?: string;
  location?: string;
  /** Free-form so "2023" / "Mar 2023" / "Present" all work. */
  start: string;
  end: string;
  bullets: string[];
};

export type EducationItem = {
  credential: string;
  org: string;
  location?: string;
  start: string;
  end: string;
  detail?: string;
};

export type SkillGroup = {
  group: string;
  items: string[];
};

export type ProjectItem = {
  name: string;
  href?: string;
  blurb: string;
  tech: string[];
};

export type Resume = {
  name: string;
  headline: string;
  location: string;
  /**
   * TODO: confirm before going live. This renders as a public mailto: link,
   * which scrapers do harvest — consider an alias rather than a primary inbox.
   */
  email: string;
  links: ResumeLink[];
  summary: string;
  experience: ExperienceItem[];
  projects: ProjectItem[];
  education: EducationItem[];
  skills: SkillGroup[];
};

export const resume: Resume = {
  name: "Shane Chan",
  headline: "Placeholder headline — e.g. Software Engineer",
  location: "City, Country",
  email: "your.address@example.com",
  links: [
    { label: "GitHub", href: "https://github.com/shanecsj" },
    { label: "LinkedIn", href: "https://www.linkedin.com/in/your-handle" },
  ],
  summary:
    "Placeholder summary. Two or three sentences on what you build, the domains you know well, and what you are looking for next.",
  experience: [
    {
      role: "Job title",
      org: "Company",
      location: "City, Country",
      start: "Jan 2024",
      end: "Present",
      bullets: [
        "Placeholder achievement — lead with the outcome, then the method, and quantify it where you can.",
        "Placeholder achievement — a second bullet showing scope or ownership.",
      ],
    },
    {
      role: "Earlier job title",
      org: "Earlier company",
      location: "City, Country",
      start: "Jun 2022",
      end: "Dec 2023",
      bullets: [
        "Placeholder achievement.",
      ],
    },
  ],
  projects: [
    {
      name: "Project name",
      href: "https://github.com/shanecsj",
      blurb: "One sentence on what it does and why it was interesting to build.",
      tech: ["TypeScript", "Next.js"],
    },
  ],
  education: [
    {
      credential: "Degree, Field of study",
      org: "University",
      location: "City, Country",
      start: "2018",
      end: "2022",
      detail: "Optional line for honours, thesis, or relevant coursework.",
    },
  ],
  skills: [
    { group: "Languages", items: ["TypeScript", "Python", "SQL"] },
    { group: "Frameworks", items: ["Next.js", "React", "Node.js"] },
    { group: "Tools", items: ["Git", "Docker", "Vercel"] },
  ],
};
