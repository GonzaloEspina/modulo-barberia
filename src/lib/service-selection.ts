import type { Service } from '@/types/service'

function parseComboParts(comboName: string): string[] {
  return comboName.split('+').map((part) => part.trim().toLowerCase()).filter(Boolean)
}

function matchesComboPart(serviceName: string, part: string): boolean {
  const name = serviceName.trim().toLowerCase()
  const token = part.trim().toLowerCase()
  return name === token || name.startsWith(`${token} `)
}

export function isPartOfCombo(service: Service, combo: Service): boolean {
  if (!combo.name.includes('+')) return false
  return parseComboParts(combo.name).some((part) => matchesComboPart(service.name, part))
}

/** Evita sumar combo + servicios que ya incluye (p. ej. Corte + Barba + Corte clásico + Barba). */
export function resolveServiceSelection(
  previous: string[],
  toggledId: string,
  services: Service[],
): string[] {
  if (previous.includes(toggledId)) {
    return previous.filter((id) => id !== toggledId)
  }

  const toggled = services.find((service) => service.id === toggledId)
  if (!toggled) return [...previous, toggledId]

  let next = [...previous, toggledId]

  if (toggled.name.includes('+')) {
    next = next.filter((id) => {
      if (id === toggledId) return true
      const service = services.find((item) => item.id === id)
      return service ? !isPartOfCombo(service, toggled) : true
    })
    return next
  }

  next = next.filter((id) => {
    if (id === toggledId) return true
    const service = services.find((item) => item.id === id)
    return service ? !isPartOfCombo(toggled, service) : true
  })

  return next
}
