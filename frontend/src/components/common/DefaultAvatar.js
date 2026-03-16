import { HiUser } from 'react-icons/hi';
import './DefaultAvatar.css';

function DefaultAvatar({ firstName, lastName, className = '', size = 'default' }) {
  const sizeClasses = {
    small: 'default-avatar-small',
    default: 'default-avatar',
    large: 'default-avatar-large',
    xl: 'default-avatar-xl',
  };

  return (
    <div className={`default-avatar-container ${sizeClasses[size]} ${className}`}>
      <HiUser />
    </div>
  );
}

export default DefaultAvatar;