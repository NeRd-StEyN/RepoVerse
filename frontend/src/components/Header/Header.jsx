// components/Header/Header.jsx
import React from 'react';
import './Header.css';
import { FaRobot } from "react-icons/fa";

const Header = () => {
  return (
    <header className="header">
      <div className="header-content">
         <div> {/* Icon scales with font size */}
      <FaRobot  size={60} color="#000000" />
    </div>
 
        <h1>RepoVerse</h1>
   
      </div>
      
    </header>
  );
};

export default Header;