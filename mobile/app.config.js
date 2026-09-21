const config=require('./app.json').expo;
module.exports=()=>({...config,android:{...config.android,versionCode:4},plugins:[...config.plugins.map(plugin=>Array.isArray(plugin)&&plugin[0]==='expo-build-properties'?[plugin[0],{...plugin[1],android:{...plugin[1].android,usesCleartextTraffic:process.env.FITLENS_TEST_BUILD==='true'}}]:plugin), './plugins/with-team-signing']});
