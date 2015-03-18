module Core {
  export interface AttributeInfo {
    type: string;
    datasetType?: Lookup<any>;
  }

  export interface DatasetValue {
    source: string;
    attributes?: Lookup<AttributeInfo>;

    // Native
    data?: Datum[];

    // Remote
    requester?: Requester.FacetRequester<any>;
    mode?: string;
    derivedAttributes?: ApplyAction[];
    filter?: Expression;
    split?: Expression;
    label?: string;
    defs?: DefAction[];
    applies?: ApplyAction[];
    sort?: SortAction;
    sortOrigin?: string;
    limit?: LimitAction;
    havingFilter?: Expression;

    // Legacy
    driver?: Legacy.Driver.FacetDriver;

    // Druid
    dataSource?: any; // ToDo: string | string[]
    timeAttribute?: string;
    forceInterval?: boolean;
    approximate?: boolean;
    context?: Lookup<any>;
  }

  export interface DatasetJS {
    source: string;
    attributes?: Lookup<AttributeInfo>;

    // Native
    data?: Datum[];

    // Remote
    filter?: ExpressionJS;

    // Legacy
    driver?: Legacy.Driver.FacetDriver;

    // Druid
    dataSource?: any; // ToDo: string | string[]
    timeAttribute?: string;
    forceInterval?: boolean;
    approximate?: boolean;
    context?: Lookup<any>;
  }

  export function mergeRemoteDatasets(remoteGroups: RemoteDataset[][]): RemoteDataset[] {
    var seen: Lookup<RemoteDataset> = {};
    remoteGroups.forEach((remoteGroup) => {
      remoteGroup.forEach((remote) => {
        var hash = remote.toHash();
        if (seen[hash]) return;
        seen[hash] = remote;
      })
    });
    return Object.keys(seen).sort().map((k) => seen[k]);
  }

// =====================================================================================
// =====================================================================================

  var check: ImmutableClass<DatasetValue, any>;
  export class Dataset implements ImmutableInstance<DatasetValue, any> {
    static type = 'DATASET';

    static jsToValue(parameters: any): DatasetValue {
      var value: DatasetValue = {
        source: parameters.source
      };
      var attributes = parameters.attributes;
      if (attributes) {
        if (typeof attributes !== 'object') {
          throw new TypeError("invalid attributes");
        } else {
          value.attributes = attributes;
        }
      }

      return value;
    }

    static isDataset(candidate: any): boolean {
      return isInstanceOf(candidate, Dataset);
    }

    static classMap: Lookup<typeof Dataset> = {};
    static register(ex: typeof Dataset): void {
      var op = (<any>ex).name.replace('Dataset', '').replace(/^\w/, (s: string) => s.toLowerCase());
      Dataset.classMap[op] = ex;
    }

    static fromJS(datasetJS: any, requester: Requester.FacetRequester<any> = null): Dataset {
      if (Array.isArray(datasetJS)) {
        datasetJS = {
          source: 'native',
          data: datasetJS
        }
      } else if (typeof datasetJS === 'function'){
        datasetJS = {
          source: 'remote',
          driver: datasetJS
        }
      }
      if (!hasOwnProperty(datasetJS, "source")) {
        throw new Error("dataset `source` must be defined");
      }
      var source: string = datasetJS.source;
      if (typeof source !== "string") {
        throw new Error("dataset must be a string");
      }
      var ClassFn = Dataset.classMap[source];
      if (!ClassFn) {
        throw new Error("unsupported dataset '" + source + "'");
      }

      return ClassFn.fromJS(datasetJS, requester);
    }

    public source: string;
    public attributes: Lookup<AttributeInfo> = null;

    constructor(parameters: DatasetValue, dummy: Dummy = null) {
      this.source = parameters.source;
      if (dummy !== dummyObject) {
        throw new TypeError("can not call `new Dataset` directly use Dataset.fromJS instead");
      }
      if (parameters.attributes) {
        this.attributes = parameters.attributes;
      }
    }

    protected _ensureSource(source: string) {
      if (!this.source) {
        this.source = source;
        return;
      }
      if (this.source !== source) {
        throw new TypeError("incorrect dataset '" + this.source + "' (needs to be: '" + source + "')");
      }
    }

    public valueOf(): DatasetValue {
      var value: DatasetValue = {
        source: this.source
      };
      if (this.attributes) {
        value.attributes = this.attributes;
      }
      return value;
    }

    public toJS(): any {
      var js: DatasetJS = {
        source: this.source
      };
      if (this.attributes) {
        js.attributes = this.attributes;
      }
      return js;
    }

    public toString(): string {
      return "Dataset(" + this.source + ")";
    }

    public toJSON(): any {
      return this.toJS();
    }

    public equals(other: Dataset): boolean {
      return Dataset.isDataset(other) &&
        this.source === other.source;
    }

    public toHash(): string {
      return this.source;
    }

    public basis(): boolean {
      return false;
    }

    public getType(): Lookup<any> {
      var attributes = this.attributes;
      if (!attributes) throw new Error("dataset has not been introspected");
      var myType: Lookup<any> = {};
      for (var attrName in attributes) {
        if (!hasOwnProperty(attributes, attrName)) continue;
        var attrType = attributes[attrName];
        myType[attrName] = attrType.type === 'DATASET' ? attrType.datasetType : attrType.type;
      }
      return myType;
    }

    public hasRemote(): boolean {
      return false;
    }

    public getRemoteDatasets(): RemoteDataset[] {
      throw new Error("can not call this directly")
    }
  }
  check = Dataset;
}
