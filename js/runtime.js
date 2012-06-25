/*
 * Assembly Runtime 
 * 
 * Copyright 2011, Kristoffer Dorph
 * http://dorphern.dk
 * 
 */

var Assembler = function(el) { this.initialize(el); }

Assembler.prototype = {
    
    initialize: function(el) {
        this.el = el;
        this.parser = new AsmParser();
        
        var that = this;
        $('#execute_button').click(function(){
            that.execute();
        });

        var that = this;

        //KeyMap
        CodeMirror.keyMap.asm = {
            "Cmd-Z" : "undo", "Ctrl-Z" : "undo",
            "Cmd-Enter" : function(){ that.execute() }, "Ctrl-Enter" : function(){ that.execute() },
            fallthrough: ["basic"]
        };

        this.editor = CodeMirror.fromTextArea(document.getElementById("code"), {
            lineNumbers: true,
            theme: 'ambiance',
            keyMap: 'asm',
            onCursorActivity: function() {
                that.editor.setLineClass(hlLine, null, null);
                hlLine = that.editor.setLineClass(that.editor.getCursor().line, null, "activeline");
            }
        });

        var hlLine = this.editor.setLineClass(0, "activeline");
    },
    
    execute: function() {
        var code = this.editor.getValue();
        this.parser.exec( code );
    }
    
};


/**
 * Assembly Parser
 */
var AsmParser = function() { this.initialize(); }

AsmParser.prototype = {
    
    running: false,

    instructions: new Array(),  //Instructions to be executed in the code.
    labels: {},                 //"HashMap" for the labels with line referencing.
    stack: new Array(),         //The stack, POP PUSH PEEK.

    human: {
        opcodes: {
            ''    : 0x0, 'SET' : 0x1, 'ADD' : 0x2, 'SUB' : 0x3,
            'MUL' : 0x4, 'DIV' : 0x5, 'MOD' : 0x6, 
            'IFE' : 0x7, 'IFN' : 0x8, 'IFG' : 0x9,
            'JSR' : 0x20
        },
        values: { 
            //Registers
            'A' : 0x00, 'B' : 0x01, 'C' : 0x02, 'D' : 0x03,
            'E' : 0x04, 'F' : 0x05, 'G' : 0x06, 'H' : 0x07,
            
            
            'POP'  : 0x1a, 'PEEK' : 0x1b, 'PUSH' : 0x1c,
            'PC'   : 0x1d, 'SP'   : 0x1e
        }
    },
    
    //Opcodes (4 bits)
    opcodes: {
        0x0  : function(a, b) {  },                                     //NULL
        0x1  : function(a, b) {                                         //SET
            var fa = _this.values[a], fb = _this.values[b];
            if (typeof fa === "function" && typeof fb === "function")
                fa( fb() );
            else if (typeof fa === "function")
                fa( _this.values[b] );
            else if (typeof fb === "function")
                _this.values[a] = fb();
            else
                _this.values[a] = _this.values[b]; 

            if (a === _this.human.values['SP']) _this.decRegister('SP');
        },
        0x2  : function(a, b) { _this.values[a] += _this.values[b]; },  //ADD
        0x3  : function(a, b) { _this.values[a] -= _this.values[b]; },  //SUB
        0x4  : function(a, b) { _this.values[a] *= _this.values[b]; },  //MUL
        0x5  : function(a, b) { _this.values[a] /= _this.values[b]; },  //DIV
        0x6  : function(a, b) { _this.values[a] %= _this.values[b]; },  //MOD
        0x7  : function(a, b) { if( !(_this.values[a] === _this.values[b]) ) _this.deltaReg('PC', 2) },  //IFE - If equal
        0x8  : function(a, b) { if( !(_this.values[a] !== _this.values[b]) ) _this.deltaReg('PC', 2) },  //IFN - If not equal
        0x9  : function(a, b) { if( !(_this.values[a] > _this.values[b]) ) _this.deltaReg('PC', 2) },    //IFG - If greater

        0x10 : function(a, b) { console.log("lool JSR"); } //JSR
    },
    
    //Values (6 bits)
    values : {
        0x00 : 0,
        0x01 : 0,
        0x02 : 0,
        0x03 : 0,
        0x04 : 0,
        0x05 : 0,
        0x06 : 0,
        0x07 : 0,
        
        0x1a : function(a) {                                                            //POP
            if (_this.getRegVal('SP') <= 0) throw "The stack is empty!"
            _this.decRegister('SP'); return _this.stack.pop(); 
        },      
        0x1b : function(a) { return _this.stack[_this.getRegVal('SP') - 1]; },          //PEEK
        0x1c : function(a) { _this.incRegister('SP'); return _this.stack.push(a); },    //PUSH
        
        0x1d : 0, //PC
        0x1e : 0, //SP

        0x3e : 0, //Temp value a
        0x40 : 0, //Temp value b
    },
    
    initialize: function() {
        _this = this;
    },
    
    // Decompose an instruction

    /* Save decompositions in an array for faster use next iteration */
    decompose: function(instruction) {
        //Match opcodes
        var elements = instruction.match(/^[\:a-z\_\-]*(\s*([A-Z]{3})\s*(\w+)\s*,\s*([\-\w]+))?(\s*;.*)?$/);
        if (elements === null) throw "This line is not a valid instruction (line " + this.values[0x1d] +")";
        return {
            'UPC' : elements[2],
            'VR1' : elements[3],
            'VR2' : elements[4],
            'CMT' : (elements[5] !== undefined ? elements[5].trim() : null)
        };
    },
    
    //Execute a single instruction
    execInstr: function(orgInstr) {
        if (orgInstr.replace(/\s*/, "") == "") return;
        instr = this.decompose( orgInstr );
        if (typeof instr.UPC === "undefined") return;

        var UPC = VR1 = VR2 = null;
        if (!isNumber(instr.UPC))
            instr.UPC = this.human.opcodes[ instr.UPC ];
        UPC = parseInt(instr.UPC);
        
        //Set the first temp value in case it is just a number
        VR1 = 0x08;
        this.setRegVal(0x08, parseInt(instr.VR1));
        //If VR1 is a hexadecimal, get the register key
        if (isNumber(instr.VR1) && instr.VR1.substr(0, 2) === "0x")
            VR1 = parseInt(instr.VR1);

        //If VR1 is a register letter prefix
        if (!isNumber(instr.VR1))
            VR1 = this.human.values[ instr.VR1 ];


        //Set the second temp value in case it is just a number
        VR2 = 0x09;
        this.setRegVal(0x09, parseInt(instr.VR2));
        //If VR2 is a hexadecimal, get the register key
        if (isNumber(instr.VR2) && instr.VR2.substr(0, 2) === "0x")
            VR2 = parseInt(instr.VR2);

        //If VR2 is a register letter prefix
        if (!isNumber(instr.VR2))
            VR2 = this.human.values[ instr.VR2 ];


        this.opcodes[UPC](VR1, VR2);
    },
    
    //Start the execution of the code
    exec: function(code) {
        if (this.running) return false; //Prevent the script from running twice at the same time.

        this.instructions = code.split(/\r\n|\r|\n/);  
        this.findLabels( this.instructions );
        //Replace the label references in the instructions with the corresponding line numbers
        this.instructions = this.setLabelRefs( this.instructions );

        //Reset stuff
        this.stack  = new Array();
        this.labels = new Array();
        $.each(this.values, function(key, val){
            if (isNumber(val))
                _this.values[key] = 0;
        });
        
        this.running = true;

        //Stat the recursive function that runs the code
        this._exec();

        return true;
    },
    
    //Find and save all the labels from the passed instructions and remove them.
    findLabels: function(instrs) {
        var label, labels = {};
        for (var i=0; i<instrs.length; i++) {
            label = instrs[i].match(/^:([a-z\_\-]*)/i);
            if (label != null) labels[label[1]] = i;
        }
        this.labels = labels;
    },

    //Replace the label references in the instructions with the corresponding line numbers
    setLabelRefs: function(instrs) {
        for (var i=0; i<instrs.length; i++) {
            instrs[i] = instrs[i].replace(/([A-Z]{3}\s*.*?)([a-z\_\-]+)/, function(a, b, c){
                return b +""+ _this.labels[c];
            });
        }
        return instrs;
    },

    //Execute one line at a time
    _exec: function() {
        if (!this.running) return; //Stop the script if running is false

        var tempPC = this.getRegVal('PC');
        //Update register view
        this.r();
        
        var instruction = this.instructions[ this.getRegVal('PC') ];
        if (typeof instruction !== "undefined") this.execInstr( instruction );
        else { this.running = false; return; }; //Terminate if this instruction doesn't exist.
        
        //Terminate if PC is greater than number of lines
        if (this.getRegVal('PC') < this.instructions.length && this.getRegVal('PC') > -1) {

            //Calls the exec through a timeout so the browser doesn't freeze
            setTimeout(function(){ 
                if (tempPC === _this.getRegVal('PC'))
                    _this.incRegister('PC');
                _this._exec(); 
            }, 0);
        } else this.running = false;
    },
    
    //Update the visual representation of the registers
    r: function() {
    
        var that = this;
        $.each(this.human.values, function(key, reg){
            var val = that.values[reg];
            if (isNumber(val)) {
                $('#reg_' + reg + ' span').html(val);
            }
        });
    },
    
    //Set register value
    getRegVal: function(key) {
        var v = key;
        if (typeof key === "string") v = this.human.values[ key ];
        if (typeof v === "undefined") throw key + " is not a valid register name.";
        return this.values[ v ];
    },

    //Set a register value
    setRegVal: function(key, val) {
        var v = key;
        if (typeof key === "string") v = this.human.values[ key ];
        if (typeof v === "undefined") throw key + " is not a valid register name.";
        return this.values[ v ] = val;
    },

    //Increment the value of a register
    incRegister: function(key) {
        return this.setRegVal(key, this.getRegVal(key) + 1);
    },

    deltaReg: function(key, d) {
        return this.setRegVal(key, this.getRegVal(key) + d);
    },

    //Decrement the value of a register
    decRegister: function(key) {
        return this.setRegVal(key, this.getRegVal(key) - 1);
    },
}


//Adding a trim function
String.prototype.trim = function () {
    return this.replace(/^\s*/, "").replace(/\s*$/, "");
}
var isNumber = function(n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
}
