export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function resolveTemplateVariables(
  template: string,
  context: {
    ticket: {
      title: string;
      number: string;
      description: string;
    };
    user?: {
      name: string;
      email: string;
    };
    assignee?: {
      name: string;
    };
    category?: {
      name: string;
    };
  }
): string {
  let result = template;

  result = result.replace(/\{\{ticket\.title\}\}/g, context.ticket.title);
  result = result.replace(/\{\{ticket\.number\}\}/g, context.ticket.number);
  result = result.replace(/\{\{ticket\.description\}\}/g, context.ticket.description);

  if (context.user) {
    result = result.replace(/\{\{user\.name\}\}/g, context.user.name);
    result = result.replace(/\{\{user\.email\}\}/g, context.user.email);
  } else {
    result = result.replace(/\{\{user\.name\}\}/g, "Nieznany");
    result = result.replace(/\{\{user\.email\}\}/g, "");
  }

  if (context.assignee) {
    result = result.replace(/\{\{assignee\.name\}\}/g, context.assignee.name);
  } else {
    result = result.replace(/\{\{assignee\.name\}\}/g, "nieprzypisany");
  }

  if (context.category) {
    result = result.replace(/\{\{category\.name\}\}/g, context.category.name);
  } else {
    result = result.replace(/\{\{category\.name\}\}/g, "");
  }

  return result;
}
