import { app } from 'electron';
import squirrelStartup from 'electron-squirrel-startup';

if (squirrelStartup) {
  app.quit();
} else {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.squirrel.our_stage.our_stage');
  }
  void import('./main.js');
}
