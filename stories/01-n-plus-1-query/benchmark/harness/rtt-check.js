const { Sequelize } = require('sequelize');
(async () => {
  for (const [label, host, port] of [['unix socket','/tmp',5433],['tcp direct','127.0.0.1',5433],['proxy +0.5ms','127.0.0.1',5434],['proxy +2.5ms','127.0.0.1',5435]]) {
    const s = new Sequelize('n1bench','postgres','',{host,port,dialect:'postgres',logging:false,pool:{max:1}});
    await s.authenticate();
    for (let i=0;i<20;i++) await s.query('SELECT 1');
    const times=[];
    for (let i=0;i<50;i++){ const t=process.hrtime.bigint(); await s.query('SELECT 1'); times.push(Number(process.hrtime.bigint()-t)/1e6); }
    times.sort((a,b)=>a-b);
    console.log(label.padEnd(14), 'median single-query round trip:', times[25].toFixed(3)+'ms');
    await s.close();
  }
})();
