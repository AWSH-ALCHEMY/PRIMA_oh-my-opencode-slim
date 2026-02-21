import { MODEL_MAPPINGS } from './providers.js';

export function verifyAgentsCommand() {
  console.log('🔍 Verifying Agent Configuration and Model Selection...\n');

  const providers = Object.keys(MODEL_MAPPINGS);

  if (providers.length === 0) {
    console.log('⚠️  No model mappings found in MODEL_MAPPINGS.');
    return;
  }

  providers.forEach(provider => {
    console.log(`📋 Provider: ${provider}`);
    const agents = MODEL_MAPPINGS[provider as keyof typeof MODEL_MAPPINGS];
    if (agents) {
      Object.entries(agents).forEach(([agent, config]) => {
        const model = typeof config === 'string' ? config : config.model;
        const variant = typeof config === 'object' && 'variant' in config ? config.variant : 'default';
        console.log(`  - ${agent}: ${model} (variant: ${variant})`);
      });
    }
    console.log('');
  });

  console.log('✅ Agent verification complete.');
}