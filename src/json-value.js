function issue(code, path, message) {
  return { code, path, message };
}

function propertyPath(path, key) {
  return /^[A-Za-z_$][\w$]*$/.test(key)
    ? `${path}.${key}`
    : `${path}[${JSON.stringify(key)}]`;
}

/** Internal, descriptor-safe validation for values that enter public DAG data. */
export function findJSONValueIssues(root, rootPath = "root") {
  const errors = [];
  const active = new Set();
  const completed = new WeakSet();
  const stack = [{ action: "visit", value: root, path: rootPath }];

  while (stack.length) {
    const frame = stack.pop();
    const { value, path } = frame;
    if (frame.action === "complete") {
      active.delete(value);
      completed.add(value);
      continue;
    }
    if (value === null) continue;
    const type = typeof value;
    if (type === "string" || type === "boolean") continue;
    if (type === "number") {
      if (!Number.isFinite(value)) {
        errors.push(
          issue(
            "non_json_number",
            path,
            "JSON numbers must be finite; NaN and Infinity are not supported.",
          ),
        );
      }
      continue;
    }
    if (type !== "object") {
      errors.push(
        issue(
          "non_json_value",
          path,
          `Values of type ${type} are not part of the JSON data model.`,
        ),
      );
      continue;
    }
    if (active.has(value)) {
      errors.push(
        issue(
          "recursive_reference",
          path,
          "Values must be JSON-safe and cannot contain object cycles.",
        ),
      );
      continue;
    }
    if (completed.has(value)) continue;

    const prototype = Object.getPrototypeOf(value);
    if (
      !Array.isArray(value) &&
      prototype !== Object.prototype &&
      prototype !== null
    ) {
      errors.push(
        issue(
          "non_json_object",
          path,
          "Expected a plain JSON object rather than a class instance.",
        ),
      );
      completed.add(value);
      continue;
    }

    active.add(value);
    stack.push({ action: "complete", value, path });
    const children = [];
    if (Array.isArray(value)) {
      for (const key of Reflect.ownKeys(value)) {
        if (key === "length") continue;
        const index = typeof key === "string" ? Number(key) : NaN;
        const isIndex =
          Number.isSafeInteger(index) &&
          index >= 0 &&
          index < value.length &&
          String(index) === key;
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!isIndex || !descriptor?.enumerable || !("value" in descriptor)) {
          errors.push(
            issue(
              "non_json_property",
              typeof key === "string" ? propertyPath(path, key) : path,
              "JSON arrays can contain only enumerable data elements.",
            ),
          );
        }
      }
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.hasOwn(value, index)) {
          errors.push(
            issue(
              "sparse_array",
              `${path}[${index}]`,
              "JSON arrays cannot contain empty slots.",
            ),
          );
          continue;
        }
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (descriptor && "value" in descriptor) {
          children.push({
            action: "visit",
            value: descriptor.value,
            path: `${path}[${index}]`,
          });
        }
      }
    } else {
      for (const key of Reflect.ownKeys(value)) {
        if (typeof key !== "string") {
          errors.push(
            issue(
              "non_json_property",
              path,
              "JSON object property names must be strings.",
            ),
          );
          continue;
        }
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor?.enumerable || !("value" in descriptor)) {
          errors.push(
            issue(
              "non_json_property",
              propertyPath(path, key),
              "JSON objects can contain only enumerable data properties.",
            ),
          );
          continue;
        }
        children.push({
          action: "visit",
          value: descriptor.value,
          path: propertyPath(path, key),
        });
      }
    }
    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push(children[index]);
    }
  }
  return errors;
}

export function assertJSONSafeValue(value, path) {
  const errors = findJSONValueIssues(value, path);
  if (errors.length) {
    const summary = errors
      .slice(0, 3)
      .map((entry) => `${entry.path}: ${entry.message}`)
      .join("; ");
    const suffix = errors.length > 3 ? `; and ${errors.length - 3} more` : "";
    throw new TypeError(`Expected JSON-safe data: ${summary}${suffix}`);
  }
  return value;
}
