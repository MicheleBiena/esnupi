import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function setup(page: Page, balance = '800') {
  await page.goto('./');
  await page.getByLabel('Il tuo saldo iniziale').fill(balance);
  await page.getByRole('button', { name: 'Salva e inizia' }).click();
  await expect(page.getByRole('heading', { name: 'Il mio mese', exact: true })).toBeVisible();
}

test('saldo → buste → spesa coperta → ricarica, su build statica', async ({ page }) => {
  const externalRequests: string[] = [];
  page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:4173/')) externalRequests.push(request.url()); });
  await setup(page);
  await expect(page.getByLabel('Saldo totale', { exact: true })).toHaveText(/800,00/);
  await page.getByRole('navigation').getByRole('link', { name: 'Buste', exact: true }).click();
  await page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Risparmi', exact: true }) }).getByRole('button', { name: 'Sposta soldi' }).click();
  await page.getByLabel('Quanto vuoi spostare?').fill('200');
  await page.getByRole('dialog').getByRole('button', { name: 'Sposta soldi', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('navigation').getByRole('link', { name: 'Il mio mese', exact: true }).click();
  await expect(page.getByLabel('Soldi accantonati')).toHaveText(/200,00/);
  await expect(page.getByLabel('Saldo totale', { exact: true })).toHaveText(/800,00/);
  await page.getByRole('button', { name: 'Aggiungi movimento' }).click();
  await expect(page.getByLabel('Da quale busta?').locator('option:checked')).toHaveText('Spese quotidiane');
  await page.getByLabel('Importo', { exact: true }).fill('50');
  await page.getByLabel('Descrizione', { exact: true }).fill('Spesa al supermercato');
  await page.getByRole('button', { name: 'Salva movimento' }).click();
  await expect(page.getByRole('alert')).toContainText('Scegli da dove coprire');
  await page.getByLabel(/^Soldi da assegnare · disponibili/).fill('50');
  await page.getByRole('button', { name: 'Salva movimento' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByLabel('Saldo totale', { exact: true })).toHaveText(/750,00/);
  await expect(page.getByLabel('Soldi da assegnare', { exact: true })).toHaveText(/550,00/);
  await page.reload();
  await expect(page.getByLabel('Saldo totale', { exact: true })).toHaveText(/750,00/);
  await expect(page.getByText('Spesa al supermercato', { exact: true })).toBeVisible();
  const storageLabel = await page.getByText('Salvato in questo browser', { exact: true }).boundingBox();
  expect(storageLabel).not.toBeNull();
  expect(storageLabel!.y + storageLabel!.height).toBeLessThanOrEqual(720);
  expect(externalRequests).toEqual([]);
  await page.screenshot({ path: 'test-results/month-desktop.png', fullPage: true });
});

test('backup esportabile, importazione validata e sostituzione esplicita', async ({ page }) => {
  await setup(page);
  await page.getByRole('link', { name: 'Impostazioni', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Esporta backup' }).click();
  const download = await downloadPromise;
  const text = await readFile((await download.path())!, 'utf8');
  const parsed = JSON.parse(text) as { format: string; schemaVersion: number };
  expect(parsed.format).toBe('esnupi-backup');
  await expect(page.getByText(/Ultimo download avviato:/)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/Ultimo download avviato:/)).toBeVisible();
  await page.getByLabel('Scegli backup esnupi').setInputFiles({ name: 'invalido.json', mimeType: 'application/json', buffer: Buffer.from(text.replace('"schemaVersion": 1', '"schemaVersion": 999')) });
  await expect(page.getByRole('alert')).toContainText('versione non supportata');
  await page.getByLabel('Scegli backup esnupi').setInputFiles({ name: 'esnupi.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await expect(page.getByRole('dialog')).toContainText('sostituisce tutti i dati');
  await page.getByRole('button', { name: 'Sostituisci e ripristina' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('navigation').getByRole('link', { name: 'Il mio mese', exact: true }).click();
  await expect(page.getByLabel('Saldo totale', { exact: true })).toHaveText(/800,00/);
});

test('obiettivo persistito, simulazione senza accantonamento e layout piccolo', async ({ page }) => {
  await setup(page, '0');
  await page.getByRole('navigation').getByRole('link', { name: 'Obiettivi', exact: true }).click();
  await expect(page.locator('main')).toBeFocused();
  await page.getByRole('button', { name: 'Nuovo obiettivo' }).click();
  await page.getByLabel('Nome dell’obiettivo').fill('Un weekend al mare');
  await page.getByLabel('Quanto costa?').fill('680');
  await page.getByLabel('Quota mensile prevista').fill('80');
  await page.getByRole('button', { name: 'Crea obiettivo' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('progressbar')).toHaveAttribute('value', '0');
  await page.getByLabel('Simula una quota mensile').fill('100');
  await expect(page.getByText(/7 quote future/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Un weekend al mare', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/goals-mobile.png', fullPage: true });
  await page.getByRole('navigation').getByRole('link', { name: 'Il mio mese', exact: true }).click();
  await expect(page.getByLabel('Saldo totale', { exact: true })).toHaveText(/0,00/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('modifica, elimina e resetta i dati con conferma esplicita', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: 'Aggiungi movimento' }).click();
  await page.getByRole('radio', { name: 'Entrata' }).check();
  await page.getByLabel('Importo', { exact: true }).fill('50');
  await page.getByLabel('Descrizione', { exact: true }).fill('Rimborso spese');
  await page.getByRole('button', { name: 'Salva movimento' }).click();

  await page.getByRole('navigation').getByRole('link', { name: 'Movimenti', exact: true }).click();
  const row = page.getByRole('listitem').filter({ hasText: 'Rimborso spese' });
  await row.getByRole('button', { name: 'Modifica' }).click();
  await page.getByLabel('Importo', { exact: true }).fill('30');
  await page.getByLabel('Descrizione', { exact: true }).fill('Rimborso corretto');
  await page.getByRole('button', { name: 'Salva modifiche' }).click();
  await expect(page.getByText('Rimborso corretto', { exact: true })).toBeVisible();
  await page.getByRole('listitem').filter({ hasText: 'Rimborso corretto' }).getByRole('button', { name: 'Elimina' }).click();
  await expect(page.getByRole('dialog')).toContainText('Rimborso corretto');
  await page.getByRole('dialog').getByRole('button', { name: 'Elimina movimento' }).click();
  await expect(page.getByText('Rimborso corretto', { exact: true })).toHaveCount(0);

  await page.getByRole('link', { name: 'Impostazioni', exact: true }).click();
  await page.screenshot({ path: 'test-results/settings-reset-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Elimina tutti i dati' }).click();
  const confirm = page.getByRole('dialog').getByRole('button', { name: 'Elimina definitivamente' });
  await expect(confirm).toBeDisabled();
  await page.getByLabel(/Scrivi ELIMINA/).fill('ELIMINA');
  await confirm.click();
  await expect(page.getByRole('heading', { name: 'Configura esnupi' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Configura esnupi' })).toBeVisible();
});

test('entrata principale, piano e abbonamento vengono riconciliati una volta', async ({ page }) => {
  await setup(page, '0');
  await page.getByRole('navigation').getByRole('link', { name: 'Ricorrenze', exact: true }).click();
  await page.getByLabel('Spese quotidiane', { exact: true }).fill('300');
  await page.getByLabel('Risparmi', { exact: true }).fill('200');
  await page.getByRole('button', { name: 'Salva piano' }).click();
  await expect(page.getByRole('status')).toContainText('Piano salvato');

  await page.getByRole('button', { name: 'Nuova ricorrenza' }).click();
  await page.getByRole('radio', { name: 'Entrata' }).check();
  await page.getByLabel('Nome', { exact: true }).fill('Entrata mensile');
  await page.getByLabel('Importo', { exact: true }).fill('800');
  await page.getByLabel('Entrata principale').check();
  await page.getByRole('button', { name: 'Salva ricorrenza' }).click();
  await expect(page.getByText('Entrata mensile', { exact: true })).toBeVisible();
  await expect(page.getByText('APPLICATO', { exact: true })).toBeVisible();
  await page.getByLabel('Svago', { exact: true }).fill('100');
  await page.getByRole('button', { name: 'Aggiorna quote del mese' }).click();
  await expect(page.getByRole('status')).toContainText('Quote del mese aggiornate');
  await expect(page.getByText(/Applicate questo mese/)).toContainText('600,00');

  await page.getByRole('button', { name: 'Nuova ricorrenza' }).click();
  await page.getByLabel('Nome', { exact: true }).fill('Telefono');
  await page.getByLabel('Importo', { exact: true }).fill('12');
  await expect(page.getByLabel('Busta').locator('option:checked')).toHaveText('Abbonamenti');
  await page.getByRole('button', { name: 'Salva ricorrenza' }).click();
  await expect(page.getByText('Telefono', { exact: true })).toBeVisible();
  let phoneRule = page.getByRole('article').filter({ hasText: 'Telefono' });
  await phoneRule.getByRole('button', { name: 'Modifica' }).click();
  await page.getByLabel('Nome', { exact: true }).fill('Telefono aggiornato');
  await page.getByLabel('Importo', { exact: true }).fill('15');
  await page.getByRole('button', { name: 'Salva modifiche' }).click();
  phoneRule = page.getByRole('article').filter({ hasText: 'Telefono aggiornato' });
  await expect(phoneRule).toContainText('15,00');
  await phoneRule.getByRole('button', { name: 'Disattiva' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Disattiva' }).click();
  await expect(phoneRule).toContainText('DISATTIVATA');
  await phoneRule.getByRole('button', { name: 'Riattiva' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Riattiva' }).click();
  await expect(phoneRule.getByRole('button', { name: 'Modifica' })).toBeVisible();
  await page.screenshot({ path: 'test-results/recurrences-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/recurrences-mobile.png', fullPage: true });

  await page.getByRole('navigation').getByRole('link', { name: 'Movimenti', exact: true }).click();
  await page.getByRole('listitem').filter({ hasText: 'Telefono' }).getByRole('button', { name: 'Correggi' }).click();
  await page.getByLabel('Importo', { exact: true }).fill('10');
  await page.getByRole('button', { name: 'Salva modifiche' }).click();
  await page.getByRole('listitem').filter({ hasText: 'Telefono' }).getByRole('button', { name: 'Elimina' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Elimina registrazione' }).click();
  await page.getByRole('navigation').getByRole('link', { name: 'Il mio mese', exact: true }).click();
  await expect(page.getByLabel('Saldo totale', { exact: true })).toHaveText(/800,00/);
  await expect(page.getByLabel('Soldi da assegnare', { exact: true })).toHaveText(/200,00/);
  await expect(page.getByLabel('Soldi accantonati')).toHaveText(/200,00/);
  await page.reload();
  await expect(page.getByLabel('Saldo totale', { exact: true })).toHaveText(/800,00/);
  await expect(page.getByText('Entrata mensile', { exact: true })).toHaveCount(1);
  await expect(page.getByText('Telefono', { exact: true })).toHaveCount(0);
});

test('rimborso collegato e filtri del diario', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: 'Aggiungi movimento' }).click();
  await page.getByLabel('Importo', { exact: true }).fill('50');
  await page.getByLabel('Descrizione', { exact: true }).fill('Scarpe');
  await page.getByRole('button', { name: 'Salva movimento' }).click();
  await page.getByLabel(/^Soldi da assegnare · disponibili/).fill('50');
  await page.getByRole('button', { name: 'Salva movimento' }).click();

  await page.getByRole('navigation').getByRole('link', { name: 'Movimenti', exact: true }).click();
  const expense = page.getByRole('listitem').filter({ hasText: 'Scarpe' });
  await expense.getByRole('button', { name: 'Rimborsa' }).click();
  await page.getByLabel('Importo rimborsato').fill('20');
  await page.getByRole('button', { name: 'Salva rimborso' }).click();
  await expect(page.getByText('Rimborso: Scarpe', { exact: true })).toBeVisible();
  const refund = page.getByRole('listitem').filter({ hasText: 'Rimborso: Scarpe' });
  await refund.getByRole('button', { name: 'Modifica' }).click();
  await page.getByLabel('Importo rimborsato').fill('15');
  await page.getByRole('button', { name: 'Salva modifiche' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: 'Rimborso: Scarpe' })).toContainText('15,00');

  await page.getByLabel('Tipo').selectOption('refund');
  await expect(page.getByRole('listitem')).toHaveCount(1);
  await expect(page.getByText('Rimborso: Scarpe', { exact: true })).toBeVisible();
  await page.getByLabel('Cerca').fill('inesistente');
  await expect(page.getByRole('heading', { name: 'Nessun movimento corrisponde ai filtri' })).toBeVisible();
  await page.getByRole('button', { name: 'Azzera filtri' }).click();
  await expect(page.getByRole('listitem')).toHaveCount(2);
  await page.getByLabel('Busta').selectOption({ label: 'Spese quotidiane' });
  await expect(page.getByRole('listitem')).toHaveCount(2);
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/movements-filters-mobile.png', fullPage: true });

  await page.getByRole('navigation').getByRole('link', { name: 'Il mio mese', exact: true }).click();
  await expect(page.getByLabel('Saldo totale', { exact: true })).toHaveText(/765,00/);
  await expect(page.getByText('Uscite, al netto dei rimborsi').locator('..')).toContainText(/35,00/);
  await page.reload();
  await expect(page.getByLabel('Saldo totale', { exact: true })).toHaveText(/765,00/);
});

test('modifica e archivia una busta, poi registra l\'acquisto di un obiettivo', async ({ page }) => {
  await setup(page, '700');

  await page.getByRole('navigation').getByRole('link', { name: 'Buste', exact: true }).click();
  await page.getByRole('button', { name: 'Nuova busta' }).click();
  await page.getByLabel('Nome della busta').fill('Temporanea');
  await page.getByRole('button', { name: 'Crea busta' }).click();
  const temporary = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Temporanea', exact: true }) });
  await temporary.getByRole('button', { name: 'Modifica' }).click();
  await page.getByLabel('Nome della busta').fill('Casa');
  await page.getByRole('button', { name: 'Salva modifiche' }).click();
  const house = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Casa', exact: true }) });
  await house.getByRole('button', { name: 'Modifica' }).click();
  await page.getByRole('button', { name: 'Archivia busta' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Archivia busta' }).click();
  await expect(page.getByRole('heading', { name: 'Casa', exact: true })).toHaveCount(0);

  await page.getByRole('navigation').getByRole('link', { name: 'Obiettivi', exact: true }).click();
  await page.getByRole('button', { name: 'Nuovo obiettivo' }).click();
  await page.getByLabel(/Nome dell/).fill('Computer');
  await page.getByLabel('Quanto costa?').fill('680');
  await page.getByLabel('Quota mensile prevista').fill('80');
  await page.getByRole('button', { name: 'Crea obiettivo' }).click();

  await page.getByRole('navigation').getByRole('link', { name: 'Buste', exact: true }).click();
  const computerEnvelope = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Computer', exact: true }) });
  await computerEnvelope.getByRole('button', { name: 'Sposta soldi' }).click();
  await page.getByLabel('Quanto vuoi spostare?').fill('690');
  await page.getByRole('dialog').getByRole('button', { name: 'Sposta soldi', exact: true }).click();

  await page.getByRole('navigation').getByRole('link', { name: 'Obiettivi', exact: true }).click();
  await page.getByRole('button', { name: 'Registra acquisto' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Registra acquisto', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Acquisti registrati' })).toBeVisible();
  await expect(page.getByRole('article').filter({ hasText: 'Computer' })).toContainText(/Residuo nella busta:.*10,00/);

  await page.getByRole('navigation').getByRole('link', { name: 'Il mio mese', exact: true }).click();
  await expect(page.getByLabel('Saldo totale', { exact: true })).toHaveText(/20,00/);
  await page.reload();
  await expect(page.getByLabel('Saldo totale', { exact: true })).toHaveText(/20,00/);
});

test('confronta insieme piano, entrata principale e quote degli obiettivi', async ({ page }) => {
  await setup(page, '0');
  await page.getByRole('navigation').getByRole('link', { name: 'Ricorrenze', exact: true }).click();
  await page.getByLabel('Spese quotidiane', { exact: true }).fill('300');
  await page.getByLabel('Risparmi', { exact: true }).fill('200');
  await page.getByRole('button', { name: 'Salva piano' }).click();

  await page.getByRole('button', { name: 'Nuova ricorrenza' }).click();
  await page.getByRole('radio', { name: 'Entrata' }).check();
  await page.getByLabel('Nome', { exact: true }).fill('Entrata mensile');
  await page.getByLabel('Importo', { exact: true }).fill('600');
  await page.getByLabel('Entrata principale').check();
  await page.getByRole('button', { name: 'Salva ricorrenza' }).click();

  await page.getByRole('navigation').getByRole('link', { name: 'Obiettivi', exact: true }).click();
  await page.getByRole('button', { name: 'Nuovo obiettivo' }).click();
  await page.getByLabel(/Nome dell/).fill('Bicicletta');
  await page.getByLabel('Quanto costa?').fill('900');
  await page.getByLabel('Quota mensile prevista').fill('150');
  await page.getByRole('button', { name: 'Crea obiettivo' }).click();

  const summary = page.getByRole('region', { name: 'Quote mensili' });
  await expect(summary).toContainText(/Entrata principale\s*600,00/);
  await expect(summary).toContainText(/Piano mensile\s*500,00/);
  await expect(summary).toContainText(/Quote obiettivi\s*150,00/);
  await expect(summary).toContainText('Quote non ancora incluse nel piano: 150,00 € al mese.');
  await expect(summary).toContainText('Mancano 50,00 € al mese');
  await page.reload();
  await expect(page.getByRole('region', { name: 'Quote mensili' })).toContainText('Mancano 50,00 € al mese');
});

test('navigazione da tastiera, chiusura dialog e reflow equivalente a zoom 200%', async ({ page }) => {
  await setup(page);
  const envelopesLink = page.getByRole('navigation').getByRole('link', { name: 'Buste', exact: true });
  await envelopesLink.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Buste', exact: true })).toBeVisible();

  const create = page.getByRole('button', { name: 'Nuova busta' });
  await create.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(create).toBeFocused();

  await page.setViewportSize({ width: 384, height: 900 });
  const overflow = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('body *')].filter(element => element.getBoundingClientRect().right > document.documentElement.clientWidth + 1).map(element => `${element.tagName.toLowerCase()}.${element.className}:${Math.round(element.getBoundingClientRect().right)}`));
  expect(overflow).toEqual([]);
});
