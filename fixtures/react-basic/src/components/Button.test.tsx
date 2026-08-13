// Excluded by default: test files describe behaviour, not the design system.
import { Button } from './Button';

it('renders', () => {
  expect(Button).toBeTypeOf('function');
});
