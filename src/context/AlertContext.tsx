// src/context/AlertContext.tsx
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import CustomAlert, { AlertButton } from '../components/CustomAlert';

interface AlertContextType {
  showAlert: (
    title: string,
    message?: string,
    buttons?: AlertButton[],
    type?: 'default' | 'success' | 'error' | 'warning'
  ) => void;
  hideAlert: () => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

interface AlertProviderProps {
  children: ReactNode;
}

export const AlertProvider: React.FC<AlertProviderProps> = ({ children }) => {
  const [visible, setVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [buttons, setButtons] = useState<AlertButton[]>([]);
  const [type, setType] = useState<'default' | 'success' | 'error' | 'warning'>('default');

  const showAlert = useCallback(
    (
      alertTitle: string,
      alertMessage?: string,
      alertButtons?: AlertButton[],
      alertType: 'default' | 'success' | 'error' | 'warning' = 'default'
    ) => {
      setTitle(alertTitle);
      setMessage(alertMessage || '');
      setType(alertType);

      // If no buttons provided, add default OK button
      setButtons(
        alertButtons || [
          {
            text: 'OK',
            style: 'default',
            onPress: () => setVisible(false),
          },
        ]
      );

      setVisible(true);
    },
    []
  );

  const hideAlert = useCallback(() => {
    setVisible(false);
  }, []);

  return (
    <AlertContext.Provider value={{ showAlert, hideAlert }}>
      {children}
      <CustomAlert
        visible={visible}
        title={title}
        message={message}
        buttons={buttons}
        onClose={hideAlert}
        type={type}
      />
    </AlertContext.Provider>
  );
};

export const useAlert = (): AlertContextType => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within AlertProvider');
  }
  return context;
};
