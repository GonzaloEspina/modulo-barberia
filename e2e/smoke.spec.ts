import { expect, test } from '@playwright/test'

test('login page loads', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByText('Iniciar sesión')).toBeVisible()
})

test('portal page loads', async ({ page }) => {
  await page.goto('/portal')
  await expect(page.getByRole('heading', { name: /portal cliente/i })).toBeVisible()
})

test('protected route redirects to login', async ({ page }) => {
  await page.goto('/clientes')
  await expect(page).toHaveURL(/\/login/)
})

test('settings page requires auth', async ({ page }) => {
  await page.goto('/configuracion')
  await expect(page).toHaveURL(/\/login/)
})
