import { Section } from "@/components/resume/section";
import { ExperienceEntry } from "@/components/resume/experience-entry";
import { EducationEntry } from "@/components/resume/education-entry";
import { resume } from "@/content/resume";

export default function ResumePage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-14">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          {resume.name}
        </h1>
        <p className="mt-2 text-base text-muted">{resume.headline}</p>

        <ul className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-faint">
          <li>{resume.location}</li>
          <li>
            <a
              href={`mailto:${resume.email}`}
              className="hover:text-accent hover:underline"
            >
              {resume.email}
            </a>
          </li>
          {resume.links.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="hover:text-accent hover:underline"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </header>

      {resume.summary ? (
        <p className="mt-8 text-[0.95rem] leading-relaxed text-muted">
          {resume.summary}
        </p>
      ) : null}

      <div className="mt-12">
        {resume.experience.length > 0 ? (
          <Section title="Experience">
            {resume.experience.map((item) => (
              <ExperienceEntry
                key={`${item.org}-${item.start}`}
                item={item}
              />
            ))}
          </Section>
        ) : null}

        {resume.projects.length > 0 ? (
          <Section title="Projects">
            {resume.projects.map((project) => (
              <article key={project.name} className="mt-7 first:mt-0">
                <h3 className="text-base font-semibold text-ink">
                  {project.href ? (
                    <a
                      href={project.href}
                      target="_blank"
                      rel="noreferrer"
                      className="decoration-rule underline-offset-4 hover:text-accent hover:decoration-accent hover:underline"
                    >
                      {project.name}
                    </a>
                  ) : (
                    project.name
                  )}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {project.blurb}
                </p>
                {project.tech.length > 0 ? (
                  <p className="mt-2 font-mono text-xs text-faint">
                    {project.tech.join(" · ")}
                  </p>
                ) : null}
              </article>
            ))}
          </Section>
        ) : null}

        {resume.education.length > 0 ? (
          <Section title="Education">
            {resume.education.map((item) => (
              <EducationEntry
                key={`${item.org}-${item.credential}`}
                item={item}
              />
            ))}
          </Section>
        ) : null}

        {resume.certifications.length > 0 ? (
          <Section title="Certifications">
            <ul className="space-y-4">
              {resume.certifications.map((cert) => (
                <li
                  key={cert.name}
                  className="flex flex-col gap-x-6 gap-y-0.5 sm:flex-row sm:items-baseline sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-ink">{cert.name}</p>
                    <p className="text-sm text-muted">{cert.issuer}</p>
                  </div>
                  <p className="shrink-0 font-mono text-xs text-faint tabular-nums">
                    {cert.issued}
                  </p>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {resume.skills.length > 0 ? (
          <Section title="Skills">
            <dl className="space-y-3">
              {resume.skills.map((group) => (
                <div
                  key={group.group}
                  className="flex flex-col gap-1 sm:flex-row sm:gap-4"
                >
                  <dt className="w-28 shrink-0 text-sm font-medium text-ink">
                    {group.group}
                  </dt>
                  <dd className="text-sm text-muted">
                    {group.items.join(" · ")}
                  </dd>
                </div>
              ))}
            </dl>
          </Section>
        ) : null}
      </div>
    </div>
  );
}
