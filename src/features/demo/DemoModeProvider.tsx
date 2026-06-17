import { useMemo, useState, type ReactNode } from 'react';
import {
  DemoModeContext,
  demoFixture,
  demoMetadata,
  demoSteps,
  type DemoModeContextValue,
} from '@/features/demo/demo-mode-context';

export function DemoModeProvider({ children }: { children: ReactNode }) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const value = useMemo<DemoModeContextValue>(() => {
    const lastStepIndex = demoSteps.length - 1;
    const safeStepIndex = Math.min(Math.max(currentStepIndex, 0), lastStepIndex);

    return {
      currentStep: demoSteps[safeStepIndex],
      currentStepIndex: safeStepIndex,
      fixture: demoFixture,
      goToStep: (index) => setCurrentStepIndex(Math.min(Math.max(index, 0), lastStepIndex)),
      isFirstStep: safeStepIndex === 0,
      isLastStep: safeStepIndex === lastStepIndex,
      metadata: demoMetadata,
      nextStep: () => setCurrentStepIndex((index) => Math.min(index + 1, lastStepIndex)),
      previousStep: () => setCurrentStepIndex((index) => Math.max(index - 1, 0)),
      reset: () => setCurrentStepIndex(0),
      steps: demoSteps,
    };
  }, [currentStepIndex]);

  return <DemoModeContext.Provider value={value}>{children}</DemoModeContext.Provider>;
}
