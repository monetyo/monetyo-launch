/**
 * Restores the email addresses and owner details `protect()` wrote reversed,
 * so they read, copy and paste normally, and turns protected email addresses
 * back into working mailto links.
 */
for (const element of document.querySelectorAll<HTMLElement>(".protected")) {
  const text = [...(element.textContent ?? "")].reverse().join("")

  element.textContent = text
  element.classList.remove("protected")
  if ("mailto" in element.dataset)
    element.setAttribute("href", `mailto:${text}`)
}
