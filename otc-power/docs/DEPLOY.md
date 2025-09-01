# Weekly automation (ET)
# Tue 03:00 – import prior week points
0 3 * * 2  cd /path/otc-power && SEASON=$(date +\%Y) npm run bt:import:sleeper >> logs/points.log 2>&1
# Wed 20:30 – scrape weekly ECR snapshots
30 20 * * 3 cd /path/otc-power && SEASON=$(date +\%Y) WEEK=<set via season calendar> npm run bt:scrape:ecr >> logs/ecr.log 2>&1
# Nightly 03:30 – recompute ranks
30 3 * * *  cd /path/otc-power && npm run recalc:nightly >> logs/recalc.log 2>&1
# Event worker as a service (PM2/systemd recommended)