<!--
  GlassCard Component Examples
  Demonstrates glassmorphism effects and variants
-->
<template>
  <div class="glass-card-examples">
    <section class="example-section">
      <h2>GlassCard Variants</h2>
      <div class="card-grid">
        <GlassCard>
          <h3>Default</h3>
          <p>Standard glass effect with 20px blur</p>
        </GlassCard>

        <GlassCard variant="subtle">
          <h3>Subtle</h3>
          <p>Lighter glass effect with 10px blur</p>
        </GlassCard>

        <GlassCard variant="strong">
          <h3>Strong</h3>
          <p>Stronger glass effect with 30px blur</p>
        </GlassCard>

        <GlassCard variant="brand">
          <h3>Brand</h3>
          <p>Brand-colored glass effect</p>
        </GlassCard>
      </div>
    </section>

    <section class="example-section">
      <h2>Interactive Cards</h2>
      <div class="card-grid">
        <GlassCard hoverable>
          <h3>Hoverable</h3>
          <p>Hover to see lift effect</p>
        </GlassCard>

        <GlassCard hoverable clickable @click="handleClick">
          <h3>Clickable</h3>
          <p>Click me! (Count: {{ clickCount }})</p>
        </GlassCard>

        <GlassCard hoverable clickable variant="brand" @click="handleBrandClick">
          <h3>Brand Click</h3>
          <p>Brand variant with interaction</p>
        </GlassCard>
      </div>
    </section>

    <section class="example-section">
      <h2>Custom Blur & Opacity</h2>
      <div class="card-grid">
        <GlassCard :blur="10" :opacity="0.5">
          <h3>Low Blur</h3>
          <p>10px blur, 50% opacity</p>
        </GlassCard>

        <GlassCard :blur="40" :opacity="0.9">
          <h3>High Blur</h3>
          <p>40px blur, 90% opacity</p>
        </GlassCard>

        <GlassCard :border-width="2" :border-opacity="0.3">
          <h3>Thick Border</h3>
          <p>2px border, 30% opacity</p>
        </GlassCard>
      </div>
    </section>

    <section class="example-section">
      <h2>Shadow Variants</h2>
      <div class="card-grid">
        <GlassCard shadow="sm">
          <h3>Small Shadow</h3>
        </GlassCard>

        <GlassCard shadow="md">
          <h3>Medium Shadow</h3>
        </GlassCard>

        <GlassCard shadow="lg">
          <h3>Large Shadow</h3>
        </GlassCard>

        <GlassCard shadow="xl">
          <h3>Extra Large Shadow</h3>
        </GlassCard>

        <GlassCard shadow="none">
          <h3>No Shadow</h3>
        </GlassCard>
      </div>
    </section>

    <section class="example-section">
      <h2>With Content</h2>
      <div class="card-grid">
        <GlassCard>
          <div class="card-content">
            <div class="card-icon">📊</div>
            <h3>Analytics Dashboard</h3>
            <p>View your performance metrics and insights</p>
            <div class="card-actions">
              <button class="btn-primary">View Details</button>
            </div>
          </div>
        </GlassCard>

        <GlassCard variant="brand">
          <div class="card-content">
            <div class="card-icon">🎨</div>
            <h3>Design System</h3>
            <p>Explore our comprehensive component library</p>
            <div class="card-actions">
              <button class="btn-secondary">Learn More</button>
            </div>
          </div>
        </GlassCard>
      </div>
    </section>

    <section class="example-section">
      <h2>Dark Mode Preview</h2>
      <p class="hint">Toggle dark mode to see how cards adapt</p>
      <div class="card-grid">
        <GlassCard>
          <h3>Adapts to Theme</h3>
          <p>This card automatically adjusts colors</p>
        </GlassCard>

        <GlassCard variant="brand">
          <h3>Brand Variant</h3>
          <p>Brand colors also adapt to dark mode</p>
        </GlassCard>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import GlassCard from '@/components/common/GlassCard.vue'
import { useDarkMode } from '@/hooks/useDarkMode'

const { isDark, toggleDark } = useDarkMode()

const clickCount = ref(0)

const handleClick = () => {
  clickCount.value++
}

const handleBrandClick = () => {
  alert('Brand card clicked!')
}
</script>

<style scoped lang="scss">
@import '@/styles/scss/global/variables.scss';

.glass-card-examples {
  padding: var(--spacing-xl);
  max-width: 1200px;
  margin: 0 auto;
  background: var(--hula-bg-secondary);
  min-height: 100vh;
}

.example-section {
  margin-bottom: var(--spacing-3xl);

  h2 {
    margin-bottom: var(--spacing-md);
    font-size: 1.5rem;
    color: var(--hula-text-primary);
  }

  .hint {
    margin-bottom: var(--spacing-md);
    color: var(--hula-text-secondary);
    font-size: 0.875rem;
  }
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: var(--spacing-lg);
}

.card-content {
  padding: var(--spacing-lg);

  .card-icon {
    font-size: 2rem;
    margin-bottom: var(--spacing-sm);
  }

  h3 {
    margin: 0 0 var(--spacing-sm) 0;
    color: var(--hula-text-primary);
  }

  p {
    margin: 0 0 var(--spacing-md) 0;
    color: var(--hula-text-secondary);
  }

  .card-actions {
    margin-top: var(--spacing-md);

    button {
      padding: var(--spacing-sm) var(--spacing-md);
      border-radius: 8px;
      border: none;
      cursor: pointer;
      font-weight: 500;
    }

    .btn-primary {
      background: var(--hula-brand-primary);
      color: white;
    }

    .btn-secondary {
      background: var(--hula-bg-tertiary);
      color: var(--hula-text-primary);
    }
  }
}

// Dark mode toggle button
.dark-mode-toggle {
  position: fixed;
  bottom: var(--spacing-lg);
  right: var(--spacing-lg);
  padding: var(--spacing-md);
  border-radius: 50%;
  background: var(--hula-bg-elevated);
  border: 1px solid var(--hula-border-default);
  cursor: pointer;
  font-size: 1.5rem;
  box-shadow: var(--hula-shadow-lg);
  z-index: 100;

  &:hover {
    transform: scale(1.1);
  }
}
</style>
