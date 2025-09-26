import React from 'react';
import { Routes, Route } from 'react-router-dom';
import MainPage from './components/MainPage';
import LockupPage from './components/LockupPage';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>🚀 Solana DApp with Spring Boot Backend</h1>
        <Routes>
          {/* URL이 '/' 일 때는 MainPage 컴포넌트를 보여줍니다. */}
          <Route path="/" element={<MainPage />} />
          
          {/* URL이 '/lockups' 일 때는 LockupPage 컴포넌트를 보여줍니다. */}
          <Route path="/lockups" element={<LockupPage />} />
        </Routes>
      </header>
    </div>
  );
}

export default App;