"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const common_1 = require("@nestjs/common");
async function bootstrap() {
    var _a;
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.useGlobalPipes(new common_1.ValidationPipe({
        enableDebugMessages: true,
        transform: true,
    }));
    app.enableCors({
        origin: '*',
        methods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'PATCH'],
        credentials: false,
    });
    await app.listen((_a = process.env.PORT) !== null && _a !== void 0 ? _a : 3000);
}
void bootstrap();
//# sourceMappingURL=main.js.map