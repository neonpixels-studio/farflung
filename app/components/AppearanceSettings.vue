<template>
  <div class="appearance">
    <fieldset class="appearance__group">
      <legend class="appearance__label">Theme</legend>
      <ul class="theme-cards">
        <li v-for="option in THEME_OPTIONS" :key="option.value">
          <button
            type="button"
            class="theme-card"
            :class="{ 'is-active': theme === option.value }"
            :aria-pressed="theme === option.value"
            @click="chooseTheme(option.value)"
          >
            <span class="theme-card__preview" :class="option.previewClass">
              <span class="theme-card__side" />
              <span class="theme-card__body" />
            </span>
            <span class="theme-card__name">
              <AppIcon :name="option.icon" :size="14" />
              {{ option.label }}
            </span>
          </button>
        </li>
      </ul>
    </fieldset>

    <fieldset class="appearance__group">
      <legend class="appearance__label">Accent colour</legend>
      <p class="appearance__hint">
        Tints buttons, links, focus rings and highlights across the app.
      </p>
      <ul class="swatches">
        <li v-for="color in ACCENT_COLORS" :key="color">
          <button
            type="button"
            class="swatch"
            :class="[`swatch--${color}`, { 'is-active': accent === color }]"
            :aria-label="`${color} accent`"
            :aria-pressed="accent === color"
            @click="chooseAccent(color)"
          >
            <span class="swatch__chip">
              <AppIcon v-if="accent === color" name="check" :size="16" />
            </span>
            <span class="swatch__name">{{ color }}</span>
          </button>
        </li>
      </ul>
    </fieldset>

    <fieldset class="appearance__group">
      <legend class="appearance__label">Preview</legend>
      <div class="appearance__preview">
        <span class="btn btn--primary btn--sm">primary</span>
        <span class="btn btn--outline btn--sm">secondary</span>
        <span class="appearance__badge">accent badge</span>
        <span class="accent-text">a tinted link</span>
      </div>
    </fieldset>

    <p v-if="saveError" class="alert alert--error" role="alert">
      {{ saveError }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { usePreferences } from "~/composables/usePreferences";
import { ACCENT_COLORS, type AccentColor } from "~/utils/accentColors";
import type { Theme } from "~/utils/theme";

const THEME_OPTIONS: {
  value: Theme;
  label: string;
  icon: string;
  previewClass: string;
}[] = [
  {
    value: "light",
    label: "Light",
    icon: "sun",
    previewClass: "theme-card__preview--light",
  },
  {
    value: "dark",
    label: "Dark",
    icon: "moon",
    previewClass: "theme-card__preview--dark",
  },
  {
    value: "system",
    label: "System",
    icon: "sliders",
    previewClass: "theme-card__preview--system",
  },
];

const { theme, accent, setTheme, setAccent } = useTheme();
const { saveError, savePreferences } = usePreferences();

function chooseTheme(next: Theme): void {
  setTheme(next);
  savePreferences({ theme: next });
}

function chooseAccent(next: AccentColor): void {
  setAccent(next);
  savePreferences({ accentColor: next });
}
</script>

<style scoped>
.appearance {
  display: flex;
  flex-direction: column;
  gap: 22px;
}
.appearance__group {
  margin: 0;
  padding: 0 0 22px;
  border: 0;
  border-bottom: 1px solid var(--line);
}
.appearance__group:last-of-type {
  padding-bottom: 0;
  border-bottom: 0;
}
.appearance__label {
  padding: 0;
  margin-bottom: 12px;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted);
}
.appearance__hint {
  margin: 0 0 12px;
  font-size: 12.5px;
  color: var(--muted);
}
.theme-cards,
.swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.theme-cards li {
  flex: 1 1 140px;
}
.theme-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  padding: 10px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  color: var(--ink);
  cursor: pointer;
  text-align: left;
}
.theme-card.is-active {
  border-color: var(--accent);
  background: var(--accent-weak);
  box-shadow: 0 0 0 1px var(--accent);
}
.theme-card__preview {
  display: flex;
  height: 64px;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 6px;
}
.theme-card__side {
  flex: 0 0 34%;
  border-right: 1px solid rgb(128 128 128 / 25%);
}
.theme-card__body {
  flex: 1;
}
.theme-card__preview--light {
  background: #f4f2ed;
}
.theme-card__preview--dark {
  background: #131310;
}
.theme-card__preview--system {
  background: linear-gradient(135deg, #f4f2ed 50%, #131310 50%);
}
.theme-card__name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
.swatch {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
  color: var(--muted);
}
.swatch__chip {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  color: #fff;
}
.swatch.is-active .swatch__chip {
  outline: 2px solid currentcolor;
  outline-offset: 2px;
}
.swatch.is-active {
  color: var(--ink);
}
.swatch__name {
  font-family: var(--font-mono);
  font-size: 11px;
}
.swatch--violet .swatch__chip {
  background: #a855f7;
}
.swatch--indigo .swatch__chip {
  background: #6366f1;
}
.swatch--blue .swatch__chip {
  background: #2f6fed;
}
.swatch--emerald .swatch__chip {
  background: #0f9d6b;
}
.swatch--amber .swatch__chip {
  background: #d98a0b;
}
.swatch--orange .swatch__chip {
  background: #ea5a0c;
}
.swatch--rose .swatch__chip {
  background: #e11d6f;
}
.swatch--graphite .swatch__chip {
  background: #3f3c36;
}
.appearance__preview {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
}
.appearance__badge {
  padding: 3px 9px;
  border: 1px solid var(--accent-line);
  border-radius: 99px;
  background: var(--accent-weak);
  color: var(--accent-ink);
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.appearance__preview .accent-text {
  margin-left: auto;
  font-size: 12.5px;
}
</style>
