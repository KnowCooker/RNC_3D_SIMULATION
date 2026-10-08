import {createServer} from 'vite';
const server=await createServer({configFile:false,optimizeDeps:{entries:['test-results/environment-refine/fixture.html'],include:['three']},server:{host:'127.0.0.1',port:5198,strictPort:true}});await server.listen();console.log('Environment fixture: http://127.0.0.1:5198/test-results/environment-refine/fixture.html');
