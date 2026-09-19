import { defineConfig } from '@playwright/test';
export default defineConfig({
 testDir:'./tests/browser',workers:1,timeout:30000,reporter:'list',outputDir:'test-results',
 use:{baseURL:'http://127.0.0.1:5178',channel:'chrome',headless:true,viewport:{width:1468,height:898},screenshot:'only-on-failure',trace:'retain-on-failure'},
 webServer:{command:'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5178 --strictPort',url:'http://127.0.0.1:5178',reuseExistingServer:true},
});
