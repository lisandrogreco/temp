import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/experimental-utils';
import { RuleFix, RuleFixer } from '@typescript-eslint/experimental-utils/dist/ts-eslint';
import { Identifier, LeftHandSideExpression, ObjectExpression, ObjectLiteralElementLike, Property, TSArrayType, TSTypeAssertion } from '@typescript-eslint/types/dist/ast-spec';
import { isObjectLiteralElement, isTypeAssertionExpression } from 'typescript';

export function getClassDeclarationFromDecorator(node: TSESTree.Decorator): TSESTree.ClassDeclaration {
	const parent = node.parent;

	if (!isClassDeclaration(parent)) {
		return;
	}
	return parent;
}

export function checkMatchingType(node: TSESTree.VariableDeclaration): boolean {
	if (node.declarations.length !== 1)
		return false;

	var declaration = node.declarations[0];

	if (isArrayExpression(declaration.init)) {
		var matchType = false;
		if(isTSArrayType( declaration.id.typeAnnotation.typeAnnotation))
		{
			matchType=checkArrayType(declaration.id.typeAnnotation.typeAnnotation)
		}
		return loopArray(declaration.init.elements, matchType);
		/*if(declaration.id.typeAnnotation.typeAnnotation.type == AST_NODE_TYPES.TSArrayType)
		{
			let arrType = declaration.id.typeAnnotation.typeAnnotation;
			if(arrType.elementType.type == AST_NODE_TYPES.TSTypeReference)
			{
				if(arrType.elementType.typeName.type == AST_NODE_TYPES.Identifier && arrType.elementType.typeName.name == "INavigationItem"){
					if(!isArrayExpression(declaration.init)) return true;
					return loopArray(declaration.init.elements);
				}				
			}
		}*/
	} else {

		if (isObjectExpression(declaration.init)) {
			return checkProperties(declaration.init);
		}
	}
	return true;
}

export function loopArray(elements: TSESTree.Expression[], isMatchingType: boolean = false) {
	return elements.filter(element => {
		if (isObjectExpression(element)) {
			return !checkProperties(element, isMatchingType);
		}
		return false;
	}).length === 0;
}

export function checkArrayType(type: TSArrayType): boolean {
	if (isTSTypeReference(type.elementType) && isIdentifier(type.elementType.typeName))
		return (type.elementType.typeName.name == "INavigationItem");
}

export function checkIdProperty(props: TSESTree.ObjectLiteralElement[], isMatchingType: boolean = false): boolean {
	var hasId = props.filter(p => {
		if (isProperty(p)) {
			if (isObjectExpression(p.value)) {
				return checkProperties(p.value);
			} else if (isArrayExpression(p.value)) {
				return loopArray(p.value.elements);
			} else if (isTSTypeAssertion(p.value)) {
				if (isTSArrayType(p.value.typeAnnotation) && checkArrayType(p.value.typeAnnotation)) {
					if (isArrayExpression(p.value.expression)) {
						return loopArray(p.value.expression.elements, true);
					} else if (isObjectExpression(p.value)) {
							return checkProperties(p.value, true);
					}

				}
			}
			else if (isIdentifier(p.key) && isMatchingType) {
				return p.key.name == "id";
			}
		}
		return false;
	}).length > 0;

	return hasId;
}

export function checkProperties(obj: ObjectExpression, isMatchingType: boolean = false): boolean {
	return checkIdProperty(obj.properties, isMatchingType);
}

export function getIdentifierName(n: Identifier): boolean {
	return n.name === 'id';
}

export function getConstructorFromClassDeclaration(node: TSESTree.ClassDeclaration): TSESTree.MethodDefinition {
	const body: TSESTree.ClassBody = node.body;

	if (!body) {
		return;
	}

	const classElements: Array<TSESTree.ClassElement> = body.body;

	if (!Array.isArray(classElements) || classElements.length === 0) {
		return;
	}

	const constructorMethodDefinition: TSESTree.ClassElement = classElements
		.filter(classElement => isMethodDefinition(classElement))
		.find(methodDefinition => (methodDefinition as TSESTree.MethodDefinition).kind === 'constructor');

	if (!constructorMethodDefinition || !isMethodDefinition(constructorMethodDefinition)) {
		return;
	}

	return constructorMethodDefinition;
}

export function getParameterPropertiesFromMethodDefinition(node: TSESTree.MethodDefinition): Array<TSESTree.TSParameterProperty> {
	const value: TSESTree.FunctionExpression = node.value as TSESTree.FunctionExpression;

	if (!isFunctionExpression(value)) {
		return undefined;
	}

	return (value.params as Array<TSESTree.TSParameterProperty>)
		.filter((node: TSESTree.TSParameterProperty) => isParameterProperty(node));
}

export function isParameterPropertyAccessibilityNamed(node: TSESTree.TSParameterProperty, accessibility: string): boolean {
	if (!isParameterProperty(node)) {
		return;
	}

	return node.accessibility === accessibility;
}

export function isParameterPropertyReadonly(node: TSESTree.TSParameterProperty): boolean {
	if (!isParameterProperty(node)) {
		return;
	}

	return node.readonly;
}

export function getMethodParameter(node: TSESTree.MethodDefinition, parameterName: string): TSESTree.Identifier {
	const value: TSESTree.FunctionExpression = node.value as TSESTree.FunctionExpression;
	if (!isFunctionExpression(value)) {
		return undefined;
	}

	return (value.params as Array<TSESTree.Identifier>)
		.filter((node: TSESTree.Identifier) => isIdentifier(node))
		.find((node: TSESTree.Identifier) => node.name === parameterName);
}

export function getMethodParameterType(node: TSESTree.Identifier | TSESTree.TSParameterProperty): TSESTree.TSTypeReference {

	if (isTSParameterProperty(node) && isIdentifier(node.parameter)) {
		node = node.parameter;
	}

	if (!isIdentifier(node)) {
		return undefined;
	}

	const typeAnnotation: TSESTree.TSTypeAnnotation = node.typeAnnotation;
	if (!typeAnnotation || !isTSTypeAnnotation(typeAnnotation)) {
		return undefined;
	}

	const typeReference: TSESTree.TSTypeReference = typeAnnotation.typeAnnotation as TSESTree.TSTypeReference;

	if (!typeReference || !isTypeReferences(typeReference)) {
		return undefined;
	}

	return typeReference;
}


export function getMethodParameterTypeName(node: TSESTree.TSTypeReference): string {
	const typeName = node.typeName;

	if (!isIdentifier(typeName)) {
		return undefined;
	}

	return typeName.name;
}

export function getLocation(node: TSESTree.Node): TSESTree.SourceLocation {
	const { loc } = node;
	if (!loc) {
		return undefined;
	}
	return {
		...loc,
		start: { ...loc.start, column: loc.start.column + 1 }
	};
}

export function getProgramFromNode(node: TSESTree.Node): TSESTree.Program {
	if (isProgram(node)) {
		return node;
	}
	return getProgramFromNode(node.parent);
}

export function getClassDeclarationFromNode(node: TSESTree.Node): TSESTree.ClassDeclaration {
	if (isClassDeclaration(node)) {
		return node;
	}

	return getClassDeclarationFromNode(node.parent);
}

export function getAddImportRuleFix(specifier: string, source: string, program: TSESTree.Program, fixer: RuleFixer): RuleFix {
	if (!isProgram(program)) {
		return undefined;
	}

	const importDeclarations: Array<TSESTree.ImportDeclaration> =
		(program.body as Array<TSESTree.ImportDeclaration>).filter(node => isImportDeclaration(node));
	const importDeclaration: TSESTree.ImportDeclaration = importDeclarations.find(node => node.source.value === source);

	if (importDeclaration) {
		const importSpecifiers = importDeclaration.specifiers as Array<TSESTree.ImportSpecifier>;
		const isSpecifierAlreadyExists: TSESTree.ImportSpecifier = importSpecifiers.find(node => node.imported.name === specifier);
		if (isSpecifierAlreadyExists) {
			return undefined;
		}
		const lastSpecifier: TSESTree.ImportSpecifier = importSpecifiers[importSpecifiers.length - 1];
		return fixer.insertTextAfter(lastSpecifier, `, ${specifier}`);
	} else {
		const lastImportDeclaration: TSESTree.ImportDeclaration = importDeclarations[importDeclarations.length - 1];
		return fixer.insertTextAfter(lastImportDeclaration, '\nimport { ' + specifier + ' } from \'' + source + '\';');
	}
}

export function isArrayExpression(node: TSESTree.Node): node is TSESTree.ArrayExpression {
	return node.type === AST_NODE_TYPES.ArrayExpression;
}
export function isTSTypeAssertion(node: TSESTree.Node): node is TSESTree.TSTypeAssertion {
	return node.type === AST_NODE_TYPES.TSTypeAssertion;
}

export function isTSArrayType(node: TSESTree.Node): node is TSESTree.TSArrayType {
	return node.type === AST_NODE_TYPES.TSArrayType;
}

export function isTSTypeReference(node: TSESTree.Node): node is TSESTree.TSTypeReference {
	return node.type === AST_NODE_TYPES.TSTypeReference;
}
export function getDecoratorPropertyValueMemberExpression(node: TSESTree.Decorator, name: string): TSESTree.MemberExpression {
	const property: TSESTree.Property = getDecoratorProperty(node, name);
	if (!property) {
		return undefined;
	}

	const value = property.value;

	if (!isMemberExpression(value)) {
		return undefined;
	}

	return value;
}

export function getDecoratorProperty(node: TSESTree.Decorator, name: string): TSESTree.Property {
	const arg: TSESTree.ObjectExpression = getDecoratorArgument(node);

	if (!arg || !isObjectExpression(arg)) {
		return undefined;
	}

	const properties: Array<ObjectLiteralElementLike> = arg.properties;
	const property: TSESTree.ObjectLiteralElementLike = properties
		.filter(prop => isProperty(prop))
		.find(prop => {
			const key: TSESTree.PropertyNameComputed = (prop as TSESTree.Property).key;
			return key && isIdentifier(key) && key.name === name;
		});

	if (!property || !isProperty(property)) {
		return undefined;
	}
	return property;
}

export function getDecoratorArgument(node: TSESTree.Decorator): TSESTree.ObjectExpression {
	const expression: LeftHandSideExpression = node.expression;
	if (
		!isCallExpression(expression) ||
		!expression.arguments ||
		expression.arguments.length === 0
	) {
		return undefined;
	}

	const arg = expression.arguments[0];

	if (!isObjectExpression(arg) || !arg.properties) {
		return undefined;
	}

	return arg;
}


export function isImportDeclaration(node: TSESTree.Node): node is TSESTree.ImportDeclaration {
	return node.type === AST_NODE_TYPES.ImportDeclaration;
}

export function isProgram(node: TSESTree.Node): node is TSESTree.Program {
	return node.type === AST_NODE_TYPES.Program;
}

export function isClassDeclaration(node: TSESTree.Node): node is TSESTree.ClassDeclaration {
	return node.type === AST_NODE_TYPES.ClassDeclaration;
}

export function isMethodDefinition(node: TSESTree.Node): node is TSESTree.MethodDefinition {
	return node.type === AST_NODE_TYPES.MethodDefinition;
}

export function isFunctionExpression(node: TSESTree.Node): node is TSESTree.FunctionExpression {
	return node.type === AST_NODE_TYPES.FunctionExpression;
}

export function isParameterProperty(node: TSESTree.Node): node is TSESTree.TSParameterProperty {
	return node.type === AST_NODE_TYPES.TSParameterProperty;
}

export function isIdentifier(node: TSESTree.Node): node is TSESTree.Identifier {
	return node.type === AST_NODE_TYPES.Identifier;
}

export function isTSParameterProperty(node: TSESTree.Node): node is TSESTree.TSParameterProperty {
	return node.type === AST_NODE_TYPES.TSParameterProperty;
}

export function isTSTypeAnnotation(node: TSESTree.Node): node is TSESTree.TSTypeAnnotation {
	return node.type === AST_NODE_TYPES.TSTypeAnnotation;
}

export function isTypeReferences(node: TSESTree.Node): node is TSESTree.TSTypeReference {
	return node.type === AST_NODE_TYPES.TSTypeReference;
}

export function isMemberExpression(node: TSESTree.Node): node is TSESTree.MemberExpression {
	return node.type === AST_NODE_TYPES.MemberExpression;
}

export function isObjectExpression(node: TSESTree.Node): node is TSESTree.ObjectExpression {
	return node.type === AST_NODE_TYPES.ObjectExpression;
}

export function isObjectLiteralExpression(node: TSESTree.Node): node is TSESTree.ObjectLiteralElement {
	return node.type === AST_NODE_TYPES.ObjectExpression;
}

export function isProperty(node: TSESTree.Node): node is TSESTree.Property {
	return node.type === AST_NODE_TYPES.Property;
}

export function isCallExpression(node: TSESTree.Node): node is TSESTree.CallExpression {
	return node.type === AST_NODE_TYPES.CallExpression;
}
