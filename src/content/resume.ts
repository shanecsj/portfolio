/**
 * All resume content lives here. The page renders whatever this file says,
 * so updating the resume never means editing markup.
 *
 * Deliberately excluded: phone number. It is in the source PDF but must not
 * appear on the public site.
 *
 * Any section left as an empty array is skipped by the page automatically.
 */

export type ResumeLink = {
  label: string;
  href: string;
};

/** One position held. An org can have several, e.g. after a promotion. */
export type Role = {
  title: string;
  bullets: string[];
};

export type ExperienceItem = {
  org: string;
  href?: string;
  location?: string;
  /** Free-form so "2023" / "Jan 2023" / "Present" all work. */
  start: string;
  end: string;
  /** Most recent first. */
  roles: Role[];
};

export type EducationItem = {
  credential: string;
  org: string;
  location?: string;
  start: string;
  end: string;
  detail?: string;
};

export type CertificationItem = {
  name: string;
  issuer: string;
  issued: string;
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
  /** Rendered as a public mailto: link. */
  email: string;
  links: ResumeLink[];
  /** Optional. Empty string hides the block. */
  summary: string;
  experience: ExperienceItem[];
  projects: ProjectItem[];
  education: EducationItem[];
  certifications: CertificationItem[];
  skills: SkillGroup[];
};

export const resume: Resume = {
  name: "Shane Chan",
  headline: "Lead Backend Developer",
  location: "Singapore",
  email: "shanecsj@gmail.com",
  links: [
    { label: "GitHub", href: "https://github.com/shanecsj" },
    { label: "LinkedIn", href: "https://linkedin.com/in/shane-chan" },
  ],
  summary: "",
  experience: [
    {
      org: "Defence Science and Technology Agency",
      location: "Singapore",
      start: "Jan 2022",
      end: "Present",
      roles: [
        {
          title: "Lead Backend Developer",
          bullets: [
            "Led and mentored a team of backend engineers, fostering collaboration and ensuring adherence to best practices in microservices development",
            "Directed the design and implementation of new features, maintaining a clean and scalable codebase to meet evolving business needs",
            "Led operations and support (O&S) for live backend systems, proactively addressing issues and ensuring more than 95% system uptime",
            "Made strategic decisions to future-proof the application, focusing on scalability, maintainability, and alignment with long-term business objectives",
            "Oversaw and managed all CI/CD pipeline changes in GitLab, rigorously reviewing features and updates to ensure smooth and error-free deployments on AWS",
          ],
        },
        {
          title: "Backend Developer",
          bullets: [
            "Built and deployed scalable microservices using Spring Boot, Elide and Hibernate, ensuring seamless integration with frontend applications and other microservices",
            "Developed and optimised RESTful APIs aligned with business use cases and requirements to ensure efficient communication, reducing response time by up to 50%",
            "Managed deployment of applications on AWS EC2 and RDS to ensure high availability and reliability",
          ],
        },
      ],
    },
    {
      org: "Defence Science and Technology Agency",
      location: "Singapore",
      start: "Jun 2021",
      end: "Nov 2021",
      roles: [
        {
          title: "Data Analytics Intern",
          bullets: [
            "Designed and implemented an intuitive data analytics tool using Python on the Jupyter Notebook interface, enabling end users to easily visualise and interpret complex datasets",
            "Conducted in-depth analysis on Geographic Information Systems (GIS), leveraging spatial data to uncover insights and support decision-making processes",
            "Utilised the developed tool to analyse and interpret road network data from the LTA Data Mall, delivering actionable insights that informed transportation planning and optimisation efforts",
          ],
        },
      ],
    },
  ],
  projects: [],
  education: [
    {
      credential: "Bachelor of Computing (Honours) in Computer Science",
      org: "National University of Singapore",
      start: "Aug 2018",
      end: "Dec 2022",
      detail: "Second Class (Upper) Honours",
    },
  ],
  certifications: [
    {
      name: "AWS Certified Solutions Architect – Associate",
      issuer: "Amazon Web Services",
      issued: "Oct 2024",
    },
    {
      name: "Certified ScrumMaster®",
      issuer: "Scrum Alliance",
      issued: "Jun 2022",
    },
    {
      name: "DS102: Data Analytics with Python",
      issuer: "Hackwagon Academy",
      issued: "Oct 2018",
    },
  ],
  skills: [
    { group: "Languages", items: ["Java", "Python", "SQL", "JavaScript"] },
    {
      group: "Frameworks",
      items: ["Spring Boot", "Hibernate", "Pandas", "React.js"],
    },
    {
      group: "Cloud",
      items: [
        "AWS EC2",
        "RDS",
        "S3",
        "API Gateway",
        "CloudWatch",
        "Secrets Manager",
        "KMS",
      ],
    },
  ],
};
