/**
 * Настройки для проверки игры. Работают только в `npm run dev`, в сборку не попадают.
 *
 * Бессмертие: `?god` в адресе (например `/?level=ladoga&checkpoint=3&god`)
 * или клавиша G прямо в уровне. Урон и пропасти не отнимают жизни.
 * Клавиша B в уровне сразу наполняет шкалу супер-удара.
 */
export const dev = {
  god: import.meta.env.DEV && new URLSearchParams(window.location.search).has('god'),
};
