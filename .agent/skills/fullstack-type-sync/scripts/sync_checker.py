import os
import re
from typing import Dict, List, Set

def get_pydantic_fields(file_path: str) -> Dict[str, Set[str]]:
    """Extracts field names from Pydantic models in a file."""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    models = {}
    # Simple regex to find class definitions and their fields
    class_matches = re.finditer(r'class\s+(\w+)\(BaseModel\):', content)
    for match in class_matches:
        model_name = match.group(1)
        start_pos = match.end()
        # Find next class or end of file
        next_class = re.search(r'\nclass\s+', content[start_pos:])
        end_pos = start_pos + next_class.start() if next_class else len(content)
        
        fields = set(re.findall(r'^\s+(\w+):', content[start_pos:end_pos], re.MULTILINE))
        models[model_name] = fields
    return models

def get_ts_interfaces(file_path: str) -> Dict[str, Set[str]]:
    """Extracts field names from TypeScript interfaces in a file."""
    if not os.path.exists(file_path):
        return {}
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    interfaces = {}
    # Simple regex to find interface definitions and their fields
    interface_matches = re.finditer(r'interface\s+(\w+)\s*{', content)
    for match in interface_matches:
        name = match.group(1)
        start_pos = match.end()
        # Find closing brace
        brace_count = 1
        end_pos = start_pos
        while brace_count > 0 and end_pos < len(content):
            if content[end_pos] == '{': brace_count += 1
            if content[end_pos] == '}': brace_count -= 1
            end_pos += 1
        
        fields = set(re.findall(r'^\s+(\w+)\??:', content[start_pos:end_pos], re.MULTILINE))
        interfaces[name] = fields
    return interfaces

def verify_sync(backend_file: str, frontend_file: str):
    """Compares fields between backend schemas and frontend interfaces."""
    py_models = get_pydantic_fields(backend_file)
    ts_interfaces = get_ts_interfaces(frontend_file)
    
    print(f"Comparing {os.path.basename(backend_file)} <-> {os.path.basename(frontend_file)}")
    for model, py_fields in py_models.items():
        if model in ts_interfaces:
            ts_fields = ts_interfaces[model]
            missing_in_ts = py_fields - ts_fields
            missing_in_py = ts_fields - py_fields
            
            if not missing_in_ts and not missing_in_py:
                print(f"✅ {model}: Perfect Sync")
            else:
                if missing_in_ts:
                    print(f"❌ {model}: Missing in TS: {missing_in_ts}")
                if missing_in_py:
                    print(f"⚠️  {model}: Extra in TS: {missing_in_py}")
        else:
            print(f"❓ {model}: Not found in TS")

if __name__ == "__main__":
    # Example usage for the AI to run
    # verify_sync("app/schemas/order.py", "frontend/types/order.ts")
    pass
