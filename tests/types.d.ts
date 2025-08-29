// Asset declarations
declare module "*.png" {
  const value: any;
  export = value;
}

declare module "*.jpeg" {
  const value: any;
  export = value;
}

declare module "*.jpg" {
  const value: any;
  export = value;
}

// Tryorama type declarations - basic module resolution
declare module "@holochain/tryorama" {
  export * from "@holochain/tryorama/lib/index";
}

// Global test utilities
declare global {
  var __filename: string;
  var __dirname: string;
}
