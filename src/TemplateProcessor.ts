import fs from "fs";

/** Templates work by subsituting strings enclosed in double at-signs. */
export type TemplateVariable = `@@${string}@@`;

/**
 * To replace @@FOO@@ with "monkeys" and @@BAR@@ with "bananas", use
 * this substitution rule:
 * ```json
 * {
 *   "@@FOO@@": "monkeys",
 *   "@@BAR@@": "bananas"
 * }
 * ```
 * You can configure your tilde directory to automatically apply substitution
 * rules to your posts.
 */
export interface SubstitutionRule {
  [templateVar: TemplateVariable]: string
};

type ProcessingError = {
  error: 1,
  reason: string
};

type Success = {
  error: 0,
  text: string
};

export type TemplateProcessingResult = ProcessingError | Success;

export function loadGmi(directory: string, filePath: string) {
  const filename = filePath.startsWith("/") ? filePath.slice(1) : filePath;
  const gmiContentsPromise = fs.promises.readFile(`${directory}/${filename}`, "utf-8");
  return {
    withSubstitutionRuleFile: (filePath: string | null): Promise<TemplateProcessingResult> => {
      return gmiContentsPromise.then((contents: string) => {
        if (filePath === null || !fs.existsSync(`${directory}/${filePath}`)) {
          return {
            error: 0,
            text: contents
          };
        } else {
          return fs.promises.readFile(`${directory}/${filePath}`, "utf-8")
            .then((subFileContents: string) => JSON.parse(subFileContents) as SubstitutionRule)
            .then((subRule: SubstitutionRule) => applyTemplateSubstitution(contents, subRule))
            .catch((error: Error) => ({
              error: 1,
              reason: `Failed to apply substitution rule to template. Error message: ${error.message}`
            }));
        }
      });
    }
  }
}

/**
 * Applies the substitution rule to the text, and returns an object with an `error` property.
 * If `error === 1`, the returned object will have a `reason` property explaining the error.
 * If `error === 0`, the returned object will have a `text` property containing the substituted text.
 */
export default function applyTemplateSubstitution(
  text: string,
  rule: SubstitutionRule
): TemplateProcessingResult {
  let resultText = `${text}`;
  for (const [key, value] of Object.entries(rule)) {
    // Validate template variables
    if (/^@@[A-Z\-]+@@$/.test(key) && typeof value === "string") {
      const substitutedText = resultText.replaceAll(key, value);
      resultText = substitutedText;
    } else {
      return {
        error: 1,
        reason:
          `The string ${key} is not a valid template variable. A valid template variable starts `
          + "with two '@' characters, ends with two '@' characters, and only contains dashes and "
          + "uppercase English letters between them, for example @@LIKE-THIS@@."
      };
    }
  }
  return {
    error: 0,
    text: resultText
  };
}
