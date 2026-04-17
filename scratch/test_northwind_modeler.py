"""
Test de l'algorithme Star Schema avec des métadonnées simulant Northwind.
"""
import sys, os
sys.path.insert(0, r'c:\Users\salah\Desktop\agent_dw_v3_fixed')

from nodes.modeler import _build_fk_graph, _score_fact_candidates, _build_star_from_relational, _generate_ddl

NORTHWIND_META = {
    "Orders": {
        "row_count": 830, "col_count": 14,
        "columns": [
            {"name": "OrderID",        "dtype": "int64"},
            {"name": "CustomerID",     "dtype": "object"},
            {"name": "EmployeeID",     "dtype": "int64"},
            {"name": "OrderDate",      "dtype": "datetime64"},
            {"name": "RequiredDate",   "dtype": "datetime64"},
            {"name": "ShippedDate",    "dtype": "datetime64"},
            {"name": "ShipVia",        "dtype": "int64"},
            {"name": "Freight",        "dtype": "float64"},
            {"name": "ShipName",       "dtype": "object"},
            {"name": "ShipAddress",    "dtype": "object"},
            {"name": "ShipCity",       "dtype": "object"},
            {"name": "ShipRegion",     "dtype": "object"},
            {"name": "ShipPostalCode", "dtype": "object"},
            {"name": "ShipCountry",    "dtype": "object"},
        ],
        "foreign_keys": [
            {"constrained_columns": ["CustomerID"], "referred_table": "Customers", "referred_columns": ["CustomerID"]},
            {"constrained_columns": ["EmployeeID"], "referred_table": "Employees", "referred_columns": ["EmployeeID"]},
            {"constrained_columns": ["ShipVia"],    "referred_table": "Shippers",  "referred_columns": ["ShipperID"]},
        ],
        "primary_key": ["OrderID"],
    },
    "Order Details": {
        "row_count": 2155, "col_count": 5,
        "columns": [
            {"name": "OrderID",   "dtype": "int64"},
            {"name": "ProductID", "dtype": "int64"},
            {"name": "UnitPrice", "dtype": "float64"},
            {"name": "Quantity",  "dtype": "int64"},
            {"name": "Discount",  "dtype": "float64"},
        ],
        "foreign_keys": [
            {"constrained_columns": ["OrderID"],   "referred_table": "Orders",   "referred_columns": ["OrderID"]},
            {"constrained_columns": ["ProductID"], "referred_table": "Products", "referred_columns": ["ProductID"]},
        ],
        "primary_key": ["OrderID", "ProductID"],
    },
    "Products": {
        "row_count": 77, "col_count": 10,
        "columns": [
            {"name": "ProductID",       "dtype": "int64"},
            {"name": "ProductName",     "dtype": "object"},
            {"name": "SupplierID",      "dtype": "int64"},
            {"name": "CategoryID",      "dtype": "int64"},
            {"name": "QuantityPerUnit", "dtype": "object"},
            {"name": "UnitPrice",       "dtype": "float64"},
            {"name": "UnitsInStock",    "dtype": "int64"},
            {"name": "UnitsOnOrder",    "dtype": "int64"},
            {"name": "ReorderLevel",    "dtype": "int64"},
            {"name": "Discontinued",    "dtype": "int64"},
        ],
        "foreign_keys": [
            {"constrained_columns": ["SupplierID"], "referred_table": "Suppliers",  "referred_columns": ["SupplierID"]},
            {"constrained_columns": ["CategoryID"], "referred_table": "Categories", "referred_columns": ["CategoryID"]},
        ],
        "primary_key": ["ProductID"],
    },
    "Categories": {
        "row_count": 8, "col_count": 4,
        "columns": [
            {"name": "CategoryID",   "dtype": "int64"},
            {"name": "CategoryName", "dtype": "object"},
            {"name": "Description",  "dtype": "object"},
            {"name": "Picture",      "dtype": "object"},
        ],
        "foreign_keys": [], "primary_key": ["CategoryID"],
    },
    "Customers": {
        "row_count": 91, "col_count": 11,
        "columns": [
            {"name": "CustomerID",   "dtype": "object"},
            {"name": "CompanyName",  "dtype": "object"},
            {"name": "ContactName",  "dtype": "object"},
            {"name": "ContactTitle", "dtype": "object"},
            {"name": "Address",      "dtype": "object"},
            {"name": "City",         "dtype": "object"},
            {"name": "Region",       "dtype": "object"},
            {"name": "PostalCode",   "dtype": "object"},
            {"name": "Country",      "dtype": "object"},
            {"name": "Phone",        "dtype": "object"},
            {"name": "Fax",          "dtype": "object"},
        ],
        "foreign_keys": [], "primary_key": ["CustomerID"],
    },
    "Employees": {
        "row_count": 9, "col_count": 17,
        "columns": [
            {"name": "EmployeeID",       "dtype": "int64"},
            {"name": "LastName",         "dtype": "object"},
            {"name": "FirstName",        "dtype": "object"},
            {"name": "Title",            "dtype": "object"},
            {"name": "TitleOfCourtesy",  "dtype": "object"},
            {"name": "BirthDate",        "dtype": "datetime64"},
            {"name": "HireDate",         "dtype": "datetime64"},
            {"name": "Address",          "dtype": "object"},
            {"name": "City",             "dtype": "object"},
            {"name": "Region",           "dtype": "object"},
            {"name": "PostalCode",       "dtype": "object"},
            {"name": "Country",          "dtype": "object"},
            {"name": "HomePhone",        "dtype": "object"},
            {"name": "Extension",        "dtype": "object"},
            {"name": "Notes",            "dtype": "object"},
            {"name": "PhotoPath",        "dtype": "object"},
            {"name": "ReportsTo",        "dtype": "float64"},
        ],
        "foreign_keys": [], "primary_key": ["EmployeeID"],
    },
    "Shippers": {
        "row_count": 3, "col_count": 3,
        "columns": [
            {"name": "ShipperID",   "dtype": "int64"},
            {"name": "CompanyName", "dtype": "object"},
            {"name": "Phone",       "dtype": "object"},
        ],
        "foreign_keys": [], "primary_key": ["ShipperID"],
    },
    "Suppliers": {
        "row_count": 29, "col_count": 12,
        "columns": [
            {"name": "SupplierID",   "dtype": "int64"},
            {"name": "CompanyName",  "dtype": "object"},
            {"name": "ContactName",  "dtype": "object"},
            {"name": "ContactTitle", "dtype": "object"},
            {"name": "Address",      "dtype": "object"},
            {"name": "City",         "dtype": "object"},
            {"name": "Region",       "dtype": "object"},
            {"name": "PostalCode",   "dtype": "object"},
            {"name": "Country",      "dtype": "object"},
            {"name": "Phone",        "dtype": "object"},
            {"name": "Fax",          "dtype": "object"},
            {"name": "HomePage",     "dtype": "object"},
        ],
        "foreign_keys": [], "primary_key": ["SupplierID"],
    },
}

# ── Run ──────────────────────────────────────────────────────────────────────
SEP = "=" * 65

print(SEP)
print("TEST : Star Schema Kimball - Northwind")
print(SEP)

fk_out, fk_in = _build_fk_graph(NORTHWIND_META)

print("\n[ Graphe FK (fk_out) ]")
for t, fks in fk_out.items():
    if fks:
        refs = [f"{fk['constrained_columns'][0]} -> {fk['referred_table']}" for fk in fks]
        print(f"  {t}: {refs}")

print("\n[ Tables referencees par d'autres (fk_in) ]")
for t, refs_by in sorted(fk_in.items(), key=lambda x: len(x[1]), reverse=True):
    print(f"  {t:25s} <- {refs_by}")

scores = _score_fact_candidates(NORTHWIND_META, fk_out, fk_in)

print("\n[ Scoring candidats Fact (desc) ]")
for t, s in scores:
    marker = " <-- SELECTIONNE" if t == scores[0][0] else ""
    print(f"  {t:30s} score = {s:6.2f}{marker}")

model = _build_star_from_relational(NORTHWIND_META, fk_out, fk_in, scores)
fact  = model["fact_table"]
dims  = model["dimension_tables"]

print(f"\n[ FACT TABLE : {fact['name']} ]")
print(f"  Source : {fact.get('source_tables', [])}")
print(f"  Colonnes ({len(fact['columns'])}) :")
for c in fact["columns"]:
    src = c.get("source_column", "")
    print(f"    [{c['role']:12s}] {c['name']:30s} {c['type']:25s} {('(src: '+src+')') if src else ''}")

print(f"\n[ DIMENSIONS ({len(dims)}) ]")
for dim in dims:
    src  = dim.get("source_tables", [])
    nat  = dim.get("natural_key", "?")
    scd  = dim.get("scd_type", "-")
    print(f"\n  {dim['name']}  (source: {src}, natural_key: {nat}, SCD{scd})")
    for c in dim["columns"]:
        src_t = c.get("source_table", "")
        print(f"    [{c['role']:12s}] {c['name']:35s} {c['type']:20s} {src_t}")

print(f"\n[ VERIFICATION CONFORMITE avec schema Kimball Northwind ]")
dim_names = [d['name'] for d in dims]
fact_fks   = [c for c in fact['columns'] if c['role'] == 'fk']
fact_mets  = [c for c in fact['columns'] if c['role'] == 'metric']
all_dim_cols = {}
for dim in dims:
    all_dim_cols[dim['name']] = [c['name'] for c in dim['columns']]

# Supplier data flattened into dim_product (snowflake -> star)
dim_prod_cols = all_dim_cols.get('dim_product', [])
supplier_in_product = any('supplier' in c for c in dim_prod_cols)
category_in_product = any('category' in c for c in dim_prod_cols)

# Calculated metrics
calc_mets = [c['name'] for c in fact['columns'] if c.get('computed')]

checks = [
    ("fact_orders present",                 fact['name'] == 'fact_orders'),
    ("Source = Orders + Order Details",     set(fact.get("source_tables", [])) == {"Orders", "Order Details"}),
    ("dim_date present",                    'dim_date' in dim_names),
    ("dim_customer present",                any('customer' in d for d in dim_names)),
    ("dim_product present",                 any('product' in d for d in dim_names)),
    ("dim_employee present",                any('employee' in d for d in dim_names)),
    ("dim_shipper present",                 any('shipper' in d for d in dim_names)),
    ("Supplier aplati dans dim_product",    supplier_in_product),
    ("Category aplati dans dim_product",    category_in_product),
    ("au moins 4 FK dans fact",             len(fact_fks) >= 4),
    ("metriques >= 4 (qty,price,disc,frt)", len(fact_mets) >= 4),
    ("sales_amount calcule",                'sales_amount' in calc_mets),
    ("net_amount calcule",                  'net_amount' in calc_mets),
    ("OrderID degenerate",                  any(c.get('role')=='degenerate' for c in fact['columns'])),
    ("SCD2 sur dim_customer",               any(d.get('scd_type')==2 for d in dims if 'customer' in d['name'])),
]

all_ok = True
for label, result in checks:
    status = "PASS" if result else "FAIL"
    if not result:
        all_ok = False
    print(f"  [{status}] {label}")

print(f"\n  RESULTAT : {'TOUS LES TESTS PASSENT !' if all_ok else 'CERTAINS TESTS ECHOUENT'}")
print(f"  Score: {sum(1 for _, r in checks if r)}/{len(checks)}")
print(SEP)
