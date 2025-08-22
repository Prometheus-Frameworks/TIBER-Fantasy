const cron = require('node-cron');
const { exec } = require('child_process');
const fs = require('fs');

// Function to run the Python update script
function runPlayerVsDefenseUpdate() {
    console.log('🔄 Starting automated player vs defense update...');
    
    const startTime = new Date();
    exec('cd scripts && python update_player_vs_defense.py', (error, stdout, stderr) => {
        const endTime = new Date();
        const duration = Math.round((endTime - startTime) / 1000);
        
        if (error) {
            console.error(`❌ Update failed after ${duration}s:`, error);
            // Log to file for debugging
            fs.appendFileSync('update.log', `${new Date().toISOString()} - ERROR: ${error}\n`);
            return;
        }
        
        if (stderr) {
            console.warn('⚠️ Update warnings:', stderr);
            fs.appendFileSync('update.log', `${new Date().toISOString()} - WARNING: ${stderr}\n`);
        }
        
        console.log(`✅ Update completed in ${duration}s`);
        console.log('Output:', stdout);
        fs.appendFileSync('update.log', `${new Date().toISOString()} - SUCCESS: Update completed in ${duration}s\n`);
    });
}

// Function to check if it's NFL season (September through February)
function isNFLSeason() {
    const month = new Date().getMonth() + 1; // getMonth() is 0-indexed
    return month >= 9 || month <= 2; // September (9) through February (2)
}

// Schedule updates during NFL season
function scheduleNFLUpdates() {
    if (!isNFLSeason()) {
        console.log('🏈 Off-season detected. Player vs defense updates are paused.');
        console.log('   Updates will automatically resume in September.');
        return;
    }
    
    console.log('🏈 NFL season detected! Setting up automated updates...');
    
    // Run every Tuesday at 10 AM (after Monday Night Football)
    // Most games are Sunday/Monday, so Tuesday ensures we catch all data
    cron.schedule('0 10 * * 2', () => {
        if (isNFLSeason()) {
            console.log('📊 Running weekly player vs defense update...');
            runPlayerVsDefenseUpdate();
        }
    }, {
        scheduled: true,
        timezone: "America/New_York"
    });
    
    // Also run every day at 7 AM during playoff season (January/February)
    // Playoffs have irregular schedules
    cron.schedule('0 7 * * *', () => {
        const month = new Date().getMonth() + 1;
        if ((month === 1 || month === 2) && isNFLSeason()) {
            console.log('🏆 Playoff season - running daily update...');
            runPlayerVsDefenseUpdate();
        }
    }, {
        scheduled: true,
        timezone: "America/New_York"
    });
    
    console.log('✅ Scheduled updates configured:');
    console.log('   📅 Every Tuesday at 10 AM (regular season)');
    console.log('   🏆 Every day at 7 AM (playoff season - Jan/Feb)');
    
    // Run initial check
    setTimeout(() => {
        console.log('🚀 Running initial update check...');
        runPlayerVsDefenseUpdate();
    }, 5000); // Wait 5 seconds after startup
}

// Start the scheduler
scheduleNFLUpdates();

// Check seasonality every month and adjust schedule if needed
cron.schedule('0 0 1 * *', () => {
    console.log('📅 Monthly season check...');
    scheduleNFLUpdates();
}, {
    scheduled: true,
    timezone: "America/New_York"
});

console.log('🤖 Player vs Defense Auto-Updater started!');
console.log('📊 Will automatically update SOS data after each game during NFL season');