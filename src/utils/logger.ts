import winston from "winston";
import env from "../config/env";

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(
  ({ level, message, timestamp, requestId, ...meta }) => {
    const metaString = Object.keys(meta).length ? JSON.stringify(meta) : "";
    return `${timestamp} [${level}]${requestId ? ` [${requestId}]` : ""}: ${message} ${metaString}`;
  },
);

const logger = winston.createLogger({
  level: env.LOG_LEVEL || "info",
  format: combine(
    errors({ stack: true }),
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    logFormat,
  ),
  defaultMeta: {},
  transports: [
    new winston.transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        logFormat,
      ),
    }),
  ],
});

// if (process.env.NODE_ENV === "production") {
//   logger.add(
//     new winston.transports.File({
//       filename: "logs/error.log",
//       level: "error",
//       maxsize: 5242880, // 5MB
//       maxFiles: 5,
//     }),
//   );

//   logger.add(
//     new winston.transports.File({
//       filename: "logs/combined.log",
//       maxsize: 5242880, // 5MB
//       maxFiles: 5,
//     }),
//   );
// }

export const attachRequestId = (requestId: string) => {
  return logger.child({ requestId });
};

export default logger;
