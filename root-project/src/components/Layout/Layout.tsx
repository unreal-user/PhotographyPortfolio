import React from 'react';
import Header from '../Header/Header';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <>
      <Header />
      <main style={{ paddingTop: 'var(--header-height)' }}>
        {children}
      </main>
    </>
  );
};

export default Layout;