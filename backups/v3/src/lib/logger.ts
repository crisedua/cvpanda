// Centralized logging utility
export class Logger {
  private static logs: string[] = [];
  private static maxLogs = 100;

  static log(component: string, message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${component}] ${message}`;
    const fullLog = data ? `${logMessage}\n${JSON.stringify(data, null, 2)}` : logMessage;
    
    console.log(fullLog);
    this.logs.push(fullLog);
    
    // Keep only the last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
    
    return fullLog;
  }

  static error(component: string, message: string, error?: any) {
    const timestamp = new Date().toISOString();
    const errorMessage = `[${timestamp}] [${component}] ERROR: ${message}`;
    const fullError = error ? 
      `${errorMessage}\n${error.message}\n${error.stack || 'No stack trace'}` : 
      errorMessage;
    
    console.error(fullError);
    this.logs.push(fullError);
    
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
    
    return fullError;
  }

  static getLogs() {
    return this.logs;
  }

  static clear() {
    this.logs = [];
  }
}

export const createComponentLogger = (component: string) => ({
  log: (message: string, data?: any) => Logger.log(component, message, data),
  error: (message: string, error?: any) => Logger.error(component, message, error)
});