import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LegalFooter from './components/LegalFooter';

test('renders legal footer links', () => {
  render(
    <MemoryRouter>
      <LegalFooter />
    </MemoryRouter>
  );
  expect(screen.getByText(/match league/i)).toBeInTheDocument();
  expect(screen.getByText(/impressum/i)).toBeInTheDocument();
});
