import React, { createContext, useState, useContext, ReactNode } from 'react';
import { CustomAlert } from '@/components/CustomAlert';
import { AlertButton } from '@/types';

interface AlertContextProps {
  showAlert: (title: string, message?: string, buttons?: AlertButton[]) => void;
}

interface AlertState {
  isVisible: boolean;
  title?: string;
  message?: string;
  buttons?: AlertButton[];
}

const AlertContext = createContext<AlertContextProps | undefined>(undefined);

export const AlertProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [alertState, setAlertState] = useState<AlertState>({ isVisible: false });

  const showAlert = (title: string, message?: string, buttons?: AlertButton[]) => {
    setAlertState({ isVisible: true, title, message, buttons });
  };

  const hideAlert = () => {
    setAlertState({ isVisible: false });
  };

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}
      <CustomAlert
        isVisible={alertState.isVisible}
        title={alertState.title}
        message={alertState.message}
        buttons={alertState.buttons}
        onClose={hideAlert}
      />
    </AlertContext.Provider>
  );
};

export const useCustomAlert = () => {
  const context = useContext(AlertContext);
  if (context === undefined) {
    throw new Error('useCustomAlert must be used within an AlertProvider');
  }
  return context;
};
